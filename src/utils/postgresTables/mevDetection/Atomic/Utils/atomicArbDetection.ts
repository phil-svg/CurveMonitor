import { TransactionDetails } from '../../../../../models/TransactionDetails.js';
import {
  BalanceChange,
  CategorizedTransfers,
  FormattedArbitrageResult,
  ProfitDetails,
  ReadableTokenTransfer,
  TransactionDetailsForAtomicArbs,
  USDValuedArbitrageResult,
} from '../../../../Interfaces.js';
import {
  CoWProtocolGPv2Settlement,
  ETH_ADDRESS,
  NULL_ADDRESS,
  ONEINCH_ADDRESS,
  WETH_ADDRESS,
} from '../../../../helperFunctions/Constants.js';
import { getGasUsedFromReceipt, getShortenReceiptByTxHash } from '../../../readFunctions/Receipts.js';
import {
  extractGasPrice,
  extractTransactionAddresses,
  getBlockNumberByTxHash,
  getTransactionDetails,
  getTransactionDetailsByTxId,
} from '../../../readFunctions/TransactionDetails.js';
import { TransactionData, Transactions } from '../../../../../models/Transactions.js';
import { Op } from 'sequelize';
import { isActuallyBackrun } from '../../../readFunctions/Sandwiches.js';
import { enrichTransactionDetail } from '../../../readFunctions/TxDetailEnrichment.js';
import {
  getBlockBuilderFromBlockNumber,
  getBlockTimeStampFromNode,
  getLastTxValue,
  getTransactionTraceViaWeb3Provider,
  getTxFromTxHash,
  getTxHashAtBlockPosition,
} from '../../../../web3Calls/generic.js';
import { saveTransactionTrace } from '../../../TransactionTraces.js';
import { getTransactionTraceFromDb } from '../../../readFunctions/TransactionTrace.js';
import { fetchAndSaveReceipt } from '../../../Receipts.js';
import { readAbiFromAbisEthereumTable } from '../../../readFunctions/Abi.js';
import {
  getEthPriceWithTimestampFromTable,
  getTokenPriceWithTimestampFromDb,
} from '../../../readFunctions/PriceMap.js';
import { getCoinIdByAddress } from '../../../readFunctions/Coins.js';
import { getBlockNumberFromTxId, getTxIdByTxHash } from '../../../readFunctions/Transactions.js';
import { getCleanedTransfers } from '../../../CleanedTransfers.js';
import { getTimestampByBlockNumber } from '../../../readFunctions/Blocks.js';

export async function buildAtomicArbDetails(
  txId: number,
  profitDetails: ProfitDetails,
  validatorPayOffInUSD: number | null
): Promise<TransactionDetailsForAtomicArbs | null> {
  const enrichedTransaction = await enrichTransactionDetail(txId);

  if (!enrichedTransaction) {
    console.log('enrichedTransaction are missing for txId', txId, 'profitDetails:', profitDetails);
    return null;
  }

  return {
    ...enrichedTransaction,
    revenue: typeof profitDetails.revenue === 'number' ? profitDetails.revenue : null,
    gasInUsd: profitDetails.gas,
    gasInGwei: typeof profitDetails.gasInGwei === 'number' ? profitDetails.gasInGwei / 1e9 : null,
    netWin: typeof profitDetails.netWin === 'number' ? profitDetails.netWin : null,
    bribe: typeof profitDetails.bribe === 'number' ? profitDetails.bribe : null,
    totalCost: typeof profitDetails.totalCost === 'number' ? profitDetails.totalCost : null,
    blockBuilder: typeof profitDetails.blockBuilder === 'string' ? profitDetails.blockBuilder : null,
    validatorPayOffUSD: typeof validatorPayOffInUSD === 'number' ? validatorPayOffInUSD : null,
  };
}

export function filterTransfersByAddress(
  cleanedTransfers: ReadableTokenTransfer[],
  to: string
): ReadableTokenTransfer[] | null {
  if (!cleanedTransfers || !to) return null;

  const lowerCaseTo = to.toLowerCase();

  return cleanedTransfers.filter((transfer) => {
    const fromLower = transfer.from?.toLowerCase();
    const toLower = transfer.to?.toLowerCase();

    return fromLower === lowerCaseTo || toLower === lowerCaseTo;
  });
}

function hasRelevantNegativeBalanceChange(balanceChanges: BalanceChange[]): boolean {
  const threshold = -0.000033; // equals 1 cent of btc as of oct'23.

  for (const change of balanceChanges) {
    if (change.balanceChange < 0 && change.balanceChange <= threshold) {
      return true;
    }
  }

  return false;
}

export async function isGlobalBackrun(transaction: TransactionData, txId: number): Promise<boolean | null> {
  if (transaction.tx_position <= 1) return false;

  const previousTxHash = await getTxHashAtBlockPosition(transaction.block_number, transaction.tx_position - 2);
  if (!previousTxHash) return null;

  const previousTx = await getTxFromTxHash(previousTxHash);
  if (!previousTx) return null;

  // comparing the senders
  if (!previousTx.to) return false;
  if (previousTx.to.toLowerCase() !== transaction.trader.toLowerCase()) return false;

  // at this point we have two tx with a gap of one, where both are done by the same address.
  // next is checking if the first one is a frontrun.

  const transactionTraces = await getTransactionTraceFromDb(previousTxHash);
  if (!transactionTraces || transactionTraces.length === 0) {
    const transactionTrace = await getTransactionTraceViaWeb3Provider(previousTxHash);
    await saveTransactionTrace(previousTxHash, transactionTrace);
  }

  const receipt = await getShortenReceiptByTxHash(previousTxHash);
  if (!receipt) {
    await fetchAndSaveReceipt(previousTxHash, txId);
  }

  const transactionDetails = await getTxFromTxHash(previousTxHash);
  if (!transactionDetails) return null;

  const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
  if (!from || !to) return null;

  const cleanedTransfers = await getCleanedTransfers(previousTxHash, to);
  if (!cleanedTransfers) return null;

  const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);

  if (hasRelevantNegativeBalanceChange(balanceChangeTo)) {
    return true;
  } else {
    return false;
  }
}

export function translateWETHToETHInTransfers(cleanedTransfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  return cleanedTransfers.map((transfer) => {
    if (transfer.tokenSymbol === 'WETH') {
      return {
        ...transfer,
        tokenSymbol: 'ETH',
        tokenAddress: ETH_ADDRESS,
      };
    }
    return transfer;
  });
}

export async function getBalanceChangeForAddressFromTransfers(
  walletAddress: string,
  cleanedTransfers: ReadableTokenTransfer[]
): Promise<BalanceChange[]> {
  const balances: { [key: string]: { symbol: string; amount: number } } = {};
  const walletAddressLowerCase = walletAddress.toLowerCase();

  const translatedTransfers = translateWETHToETHInTransfers(cleanedTransfers);

  translatedTransfers.forEach((transfer) => {
    // Check if 'from' and 'to' are defined and convert them to lowercase
    const fromAddress = transfer.from ? transfer.from.toLowerCase() : null;
    const toAddress = transfer.to ? transfer.to.toLowerCase() : null;

    // If the address is involved in the transaction
    if (fromAddress === walletAddressLowerCase || toAddress === walletAddressLowerCase) {
      const address = transfer.tokenAddress;
      const symbol = transfer.tokenSymbol || 'Unknown Token';

      if (!balances[address]) {
        balances[address] = { symbol: symbol, amount: 0 };
      }

      if (fromAddress === walletAddressLowerCase) {
        balances[address].amount -= transfer.parsedAmount;
      }
      if (toAddress === walletAddressLowerCase) {
        balances[address].amount += transfer.parsedAmount;
      }
    }
  });

  // Filter out values smaller than 1e-7 in magnitude and map to BalanceChange array
  const filteredBalances: BalanceChange[] = Object.keys(balances)
    .filter((token) => Math.abs(balances[token].amount) >= 1e-7)
    .map((token) => ({
      tokenAddress: token,
      balanceChange: balances[token].amount,
      tokenSymbol: balances[token].symbol,
    }));

  return filteredBalances;
}

type BalanceChanges = { [address: string]: { symbol: string; amount: number } };

/**
 * Merges multiple BalanceChanges objects into a single BalanceChanges.
 *
 * @param ...balanceChanges - The BalanceChanges objects to be merged.
 * @returns A merged BalanceChanges.
 */
function mergeBalanceChanges(...balanceChanges: BalanceChanges[]): BalanceChanges {
  const merged: BalanceChanges = {};

  // Iterate over each BalanceChanges
  balanceChanges.forEach((bc) => {
    // Iterate over each address in the BalanceChanges
    for (const address in bc) {
      // If the address is already in the merged result
      if (merged.hasOwnProperty(address)) {
        merged[address].amount += bc[address].amount;
      } else {
        merged[address] = { ...bc[address] };
      }
    }
  });

  // Remove entries with 0 amount
  for (const address in merged) {
    if (merged[address].amount === 0) {
      delete merged[address];
    }
  }

  return merged;
}

const calculateBalanceChangesForMints = (
  liquidityPairs: ReadableTokenTransfer[][],
  calledContractAddress: string
): BalanceChanges => {
  let balanceChange: BalanceChanges = {};
  const calledAddressLower = calledContractAddress.toLowerCase();

  liquidityPairs.forEach((pair) => {
    pair.forEach((mint, index) => {
      const address = mint.tokenAddress;
      const symbol = mint.tokenSymbol || 'Unknown Token';

      if (!balanceChange[address]) {
        balanceChange[address] = { symbol: symbol, amount: 0 };
      }

      if (index === 0 && mint.from.toLowerCase() === calledAddressLower) {
        // Deduct the token used for minting
        balanceChange[address].amount -= mint.parsedAmount;
      } else if (index === 1 && mint.to.toLowerCase() === calledAddressLower) {
        // Add the minted token to the balance
        balanceChange[address].amount += mint.parsedAmount;
      }
    });
  });

  return balanceChange;
};

function hasIllegalTransfers(cleanedTransfers: ReadableTokenTransfer[]): boolean {
  const shortenedNull = '0x000000000000000000000000000000000';
  const nullTransfersCount = cleanedTransfers.reduce((count, transfer) => {
    if (transfer.from.startsWith(shortenedNull) && transfer.to.startsWith(shortenedNull)) {
      return count + 1;
    }
    return count;
  }, 0);

  return nullTransfersCount >= 3;
}

function checkIlleglWETHTransfer(
  cleanedTransfers: ReadableTokenTransfer[],
  balanceChangesTo: BalanceChange[],
  toAddress: string
): boolean {
  const ETH_SYMBOL = 'ETH';
  toAddress = toAddress.toLowerCase();

  // Filter for WETH transfers received by toAddress
  const receivedWETHTransfers = cleanedTransfers.filter(
    (transfer) => transfer.to.toLowerCase() === toAddress && transfer.tokenSymbol === 'WETH'
  );

  // Check for exactly one received WETH transfer
  if (receivedWETHTransfers.length === 1) {
    const receivedWETHAmount = receivedWETHTransfers[0].parsedAmount;

    // Check balance changes for a positive ETH balance change that matches the received WETH amount
    const matchingETHBalanceChange = balanceChangesTo.some(
      (change) => change.tokenSymbol === ETH_SYMBOL && change.balanceChange === receivedWETHAmount
    );

    return matchingETHBalanceChange;
  }

  return false;
}

export function hasIllegalOutboundsToFrom(transfers: ReadableTokenTransfer[], from: string): boolean {
  const countToFrom = transfers.filter((transfer) => transfer.to.toLowerCase() === from.toLowerCase()).length;
  return countToFrom >= 2;
}

/**
 * all balance changes are positive
 * or
 * if outflowing eth, all other balance changes (of which there has to be at least one) are postive
 * and
 * there were balance changes at all
 * and
 * ETH leaf (bribe)
 * @param cleanedTransfers a sorted list of all decoded token transfers for a given tx
 * @param balanceChanges token balance changes for "from" and "to" (bot and bot operator)
 * @param from the address which called the bot
 * @param to the bots' address
 * @returns
 */
export function isAtomicArbCaseValueStaysWithFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  balanceChangesFrom: BalanceChange[],
  balanceChangesTo: BalanceChange[],
  from: string,
  to: string
): boolean {
  if (balanceChangesFrom.length === 0 && balanceChangesTo.length === 0) return false;

  let hasNegativeEthChangeFrom = false;
  let hasNegativeEthChangeTo = false;
  let hasNonEthNegativeChange = false;
  let hasPositiveChangeInFrom = false;
  let hasPositiveChangeInTo = false;

  for (const change of balanceChangesFrom) {
    if (change.tokenSymbol === 'ETH' && change.balanceChange < 0) {
      hasNegativeEthChangeFrom = true;
      break;
    } else if (change.balanceChange < 0) {
      hasNonEthNegativeChange = true;
      break;
    } else if (change.balanceChange > 0) {
      hasPositiveChangeInFrom = true;
    }
  }

  for (const change of balanceChangesTo) {
    if (change.tokenSymbol === 'ETH' && change.balanceChange < 0) {
      hasNegativeEthChangeTo = true;
    } else if (change.balanceChange < 0) {
      hasNonEthNegativeChange = true;
      break;
    } else if (change.balanceChange > 0) {
      hasPositiveChangeInTo = true;
    }
  }

  if (hasNegativeEthChangeFrom) return false;
  if (hasNegativeEthChangeTo) return false;
  if (hasPositiveChangeInFrom && hasPositiveChangeInTo) return false;
  if (hasNonEthNegativeChange) return false;

  if (hasIllegalTransfers(cleanedTransfers)) return false;
  if (checkIlleglWETHTransfer(cleanedTransfers, balanceChangesTo, to)) return false;

  // Filter out ETH transfers
  const ethTransfers = cleanedTransfers.filter((transfer) => transfer.tokenSymbol === 'ETH');

  // Filter leafs which receive ETH
  const leafReceivers = ethTransfers.filter((ethTransfer) => {
    return cleanedTransfers.some((transfer) => {
      return (
        transfer.from.toLowerCase() === ethTransfer.to.toLowerCase() ||
        transfer.to.toLowerCase() === ethTransfer.to.toLowerCase()
      );
    });
  });

  // Check if any of these leaf addresses are NOT either "from" or "to", but also come from "toAddress"
  const hasValidLeaf = leafReceivers.some((leafReceiver) => {
    return (
      leafReceiver.to.toLowerCase() !== from.toLowerCase() &&
      leafReceiver.to.toLowerCase() !== to.toLowerCase() &&
      leafReceiver.from.toLowerCase() === to.toLowerCase()
    );
  });

  // If no valid leaf address is found, return false.
  if (!hasValidLeaf && balanceChangesTo.length === 0) return false;

  if (hasNegativeEthChangeTo) {
    return hasPositiveChangeInFrom || hasPositiveChangeInTo;
  }

  if (hasIllegalOutboundsToFrom(cleanedTransfers, from)) return false;

  return true;
}

async function getValueReceivedByLeaf(
  token: string,
  parsedAmount: number,
  block_unixtime: number
): Promise<number | null> {
  const tokenId = await getCoinIdByAddress(token);
  if (!tokenId) return null;
  const price = await getTokenPriceWithTimestampFromDb(tokenId, block_unixtime);
  if (!price) return null;
  return price * parsedAmount;
}

/**
 * Checks if a given address is part of any transfer in the cleanedTransfers array,
 * excluding a specified transfer.
 *
 * @param cleanedTransfers - Array of ReadableTokenTransfer objects.
 * @param transfer - The transfer to exclude from the search.
 * @param address - The address to search for in the transfers.
 * @returns true if the address is found in any transfer other than the specified transfer.
 */
export function isTrueLeaf(
  cleanedTransfers: ReadableTokenTransfer[],
  transfer: ReadableTokenTransfer,
  address: string
): boolean {
  const lowerCaseAddress = address.toLowerCase();

  // Iterate through the cleanedTransfers array to check if the address is involved in other transfers
  for (const t of cleanedTransfers) {
    // Exclude the current transfer from the check
    if (t.position !== transfer.position) {
      // Check if the address is a sender or receiver in any other transfer
      if (t.from.toLowerCase() === lowerCaseAddress || t.to.toLowerCase() === lowerCaseAddress) {
        return false; // Address found in another transfer, hence not a leaf
      }
    }
  }

  // Address is not involved in any other transfer, hence it is a leaf
  return true;
}

/**
 * Checks if a transfer is from the bot or the bot operator to a different address,
 * and if the recipient is a leaf node.
 *
 * @param transfer - The transfer to check.
 * @param from - The address of the bot.
 * @param to - The address of the bot operator.
 * @param cleanedTransfers - All transfers to check against for the leaf node.
 * @returns true if the transfer is from the bot or bot operator to a different address, which is a leaf node.
 */
export function botOrFromTransferToLeaf(
  transfer: ReadableTokenTransfer,
  from: string,
  to: string,
  cleanedTransfers: ReadableTokenTransfer[]
): boolean {
  return (
    (transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase()) &&
    transfer.to.toLowerCase() !== from.toLowerCase() &&
    transfer.to.toLowerCase() !== to.toLowerCase() &&
    isTrueLeaf(cleanedTransfers, transfer, transfer.to)
  );
}

// New check for the case where value goes outside "from" and "to".
async function isAtomicArbCaseValueGoesOutsideFromOrTo(
  onlyToTransfers: ReadableTokenTransfer[],
  cleanedTransfers: ReadableTokenTransfer[],
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string,
  block_unixtime: number
): Promise<[boolean, number]> {
  if (balanceChangeFrom.length !== 0 || balanceChangeTo.length !== 0) return [false, 0];

  const filteredOnlyToTransfers = onlyToTransfers.filter((t) => t.from.toLowerCase() !== from.toLowerCase());

  if (filteredOnlyToTransfers.length === 0) return [false, 0];

  if (isLeaf(filteredOnlyToTransfers[0].from, cleanedTransfers.slice(1))) {
    const dollarValue = await getValueReceivedByLeaf(
      filteredOnlyToTransfers[0].tokenAddress,
      filteredOnlyToTransfers[0].parsedAmount,
      block_unixtime
    );
    if (!dollarValue) return [false, 0];
    return [true, dollarValue];
  }

  for (let i = cleanedTransfers.length - 1; i >= cleanedTransfers.length - 2; i--) {
    let transfer = cleanedTransfers[i];

    if (botOrFromTransferToLeaf(transfer, from, to, cleanedTransfers)) {
      // Last transfer matches
      if (i === cleanedTransfers.length - 1) {
        // Check the second-to-last transfer for the special case
        let secondToLastTransfer = cleanedTransfers[cleanedTransfers.length - 2];
        if (
          secondToLastTransfer.tokenAddress.toLowerCase() !== ETH_ADDRESS.toLowerCase() &&
          secondToLastTransfer.tokenAddress.toLowerCase() !== WETH_ADDRESS.toLowerCase()
        ) {
          // If the second-to-last transfer is not ETH or WETH, continue checking
          return [false, 0];
        }
      }

      return [true, 0];
    }
  }

  return [false, 0];
}

function convertWETHtoETHforBalanceChanges(balanceChanges: BalanceChanges): BalanceChanges {
  const updatedBalances: BalanceChanges = { ...balanceChanges };

  if (updatedBalances[WETH_ADDRESS]) {
    const wethAmount = updatedBalances[WETH_ADDRESS].amount;

    if (updatedBalances[ETH_ADDRESS]) {
      updatedBalances[ETH_ADDRESS].amount += wethAmount;
    } else {
      updatedBalances[ETH_ADDRESS] = { symbol: 'ETH', amount: wethAmount };
    }

    delete updatedBalances[WETH_ADDRESS];
  }

  return updatedBalances;
}

export function marketArbitrageSection(
  readableTransfers: CategorizedTransfers,
  calledContractAddress: string
): BalanceChanges {
  const calculateBalanceChangesForSwaps = (
    swaps: ReadableTokenTransfer[][],
    calledContractAddress: string
  ): BalanceChanges => {
    let balanceChange: BalanceChanges = {};

    const calledAddressLower = calledContractAddress.toLowerCase();

    const calculateForSwap = (swap: ReadableTokenTransfer[]) => {
      for (const transfer of swap) {
        const address = transfer.tokenAddress;
        const symbol = transfer.tokenSymbol || 'Unknown Token';

        if (!balanceChange[address]) {
          balanceChange[address] = { symbol: symbol, amount: 0 };
        }

        if (transfer.from.toLowerCase() === calledAddressLower) {
          balanceChange[address].amount -= transfer.parsedAmount;
        }
        if (transfer.to.toLowerCase() === calledAddressLower) {
          balanceChange[address].amount += transfer.parsedAmount;
        }
      }
    };

    swaps.forEach(calculateForSwap);
    return balanceChange;
  };

  const balanceChangeSwaps = calculateBalanceChangesForSwaps(readableTransfers.swaps, calledContractAddress);
  const balanceChangeMultiStepSwaps = calculateBalanceChangesForSwaps(
    readableTransfers.multiStepSwaps,
    calledContractAddress
  );
  const balanceChangeMints = calculateBalanceChangesForMints(readableTransfers.liquidityPairs, calledContractAddress);

  // Combine balance changes
  const combinedBalanceChanges = mergeBalanceChanges(
    balanceChangeSwaps,
    balanceChangeMultiStepSwaps,
    balanceChangeMints
  );

  // sum WETH against ETH
  const finalBalanceChanges = convertWETHtoETHforBalanceChanges(combinedBalanceChanges);

  return finalBalanceChanges;
}

export function bribe(
  readableTransfers: CategorizedTransfers,
  from: string
): { address: string; symbol: string; amount: number } {
  let totalOutflowingETH = 0;

  for (const transfer of readableTransfers.outflowingETH) {
    if (transfer.to.toLowerCase() === from.toLowerCase()) continue; // excluding eth being send from bot to bot owner from bribe amount
    totalOutflowingETH += transfer.parsedAmount;
  }

  return {
    address: ETH_ADDRESS,
    symbol: 'ETH',
    amount: totalOutflowingETH,
  };
}

function convertWETHToETH(balanceChanges: BalanceChanges): BalanceChanges {
  let converted: BalanceChanges = {};

  for (const address in balanceChanges) {
    if (address.toLowerCase() === WETH_ADDRESS) {
      converted[ETH_ADDRESS] = { ...balanceChanges[address], symbol: 'ETH' };
    } else {
      converted[address] = balanceChanges[address];
    }
  }

  return converted;
}

/**
 * Get leaf ETH transfers which are neither to "from" nor "to" and are received from "from" or "to".
 *
 * @param transfers List of token transfers
 * @param from Excluded from address as bribe receiver but included as a sender
 * @param to Excluded to address as bribe receiver but included as a sender
 */
export function getLeafEthTransfers(
  transfers: ReadableTokenTransfer[],
  from: string,
  to: string
): ReadableTokenTransfer[] {
  return transfers.filter((transfer) => {
    const isEthTransfer = transfer.tokenSymbol === 'ETH';

    const isLeaf = !transfers.some((otherTransfer) => otherTransfer.from.toLowerCase() === transfer.to.toLowerCase());

    const isNotFromOrTo =
      transfer.to.toLowerCase() !== from.toLowerCase() && transfer.to.toLowerCase() !== to.toLowerCase();

    const isReceivedFromFromOrTo =
      transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase();

    return isEthTransfer && isLeaf && isNotFromOrTo && isReceivedFromFromOrTo;
  });
}

// leafs which receive eth and are not bot (to) or botoperator (from)
function calculateBribeAmoundForMoreThanOneBribe(
  transfers: ReadableTokenTransfer[],
  from: string,
  to: string
): { address: string; symbol: string; amount: number; blockBuilder: string | null } {
  const ethLeafTransfers = getLeafEthTransfers(transfers, from, to);

  let bribeAmount = 0;
  ethLeafTransfers.forEach((transfer) => {
    bribeAmount += transfer.parsedAmount;
  });

  let blockBuilder;
  if (ethLeafTransfers.length === 0) {
    blockBuilder = null;
  } else {
    blockBuilder = ethLeafTransfers[ethLeafTransfers.length - 1].to;
  }

  return {
    address: ETH_ADDRESS,
    symbol: 'ETH',
    amount: bribeAmount,
    blockBuilder: blockBuilder,
  };
}

function calculateBribeAmoundForSingleBribe(
  transfers: ReadableTokenTransfer[],
  from: string,
  to: string
): { address: string; symbol: string; amount: number } {
  const ethLeafTransfers = getLeafEthTransfers(transfers, from, to);

  if (ethLeafTransfers.length < 2) {
    return calculateBribeAmoundForMoreThanOneBribe(transfers, from, to);
  }

  const bribeTransfer = ethLeafTransfers[ethLeafTransfers.length - 2];

  return {
    address: ETH_ADDRESS,
    symbol: 'ETH',
    amount: bribeTransfer.parsedAmount,
  };
}

function calculateExtractedValueCaseValueStaysWithFromOrTo(
  balanceChanges: BalanceChange[],
  bribe: number
): { address: string; symbol: string; amount: number }[] {
  let ethPresent = false;

  const newExtractedValue = balanceChanges.map((change) => {
    const isEth = change.tokenSymbol === 'ETH' || change.tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase();
    if (isEth) {
      ethPresent = true;
      return { address: change.tokenAddress, symbol: 'ETH', amount: change.balanceChange + bribe };
    }
    return {
      address: change.tokenAddress,
      symbol: change.tokenSymbol || 'Unknown Token',
      amount: change.balanceChange,
    };
  });

  if (!ethPresent && bribe > 0) {
    newExtractedValue.push({ address: ETH_ADDRESS, symbol: 'ETH', amount: bribe });
  }

  return newExtractedValue;
}

function calculateExtractedValueCaseValueGoesOutsideFromOrTo(
  transfers: ReadableTokenTransfer[],
  from: string,
  to: string
): { address: string; symbol: string; amount: number }[] | null {
  const accumulatedTransfers: { [address: string]: { symbol: string; amount: number } } = {};

  // Create a set of all 'from' addresses for quick lookup
  const fromAddresses = new Set(transfers.map((transfer) => transfer.from.toLowerCase()));

  // Filtering the transfers that originated from 'from' or 'to' and were sent to some other addresses (not 'from' or 'to')
  // Also checking that the recipient address doesn't show up as a 'from' address in the full transfer list
  let relevantTransfers = transfers.filter(
    (transfer) =>
      (transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase()) &&
      transfer.to.toLowerCase() !== from.toLowerCase() &&
      transfer.to.toLowerCase() !== to.toLowerCase() &&
      !fromAddresses.has(transfer.to.toLowerCase())
  );

  // Sort by position and only take the chunk at the end
  if (relevantTransfers.length === 0) return null;
  relevantTransfers.sort((a, b) => a.position! - b.position!);
  let lastPosition = relevantTransfers[relevantTransfers.length - 1].position;
  let endIndex = relevantTransfers.length - 1;

  // Find the start index of the chunk at the end
  while (endIndex > 0 && relevantTransfers[endIndex - 1].position === lastPosition! - 1) {
    endIndex--;
    lastPosition!--;
  }

  relevantTransfers = relevantTransfers.slice(endIndex);

  for (const transfer of relevantTransfers) {
    if (!accumulatedTransfers[transfer.tokenAddress]) {
      accumulatedTransfers[transfer.tokenAddress] = { symbol: transfer.tokenSymbol || 'Unknown Token', amount: 0 };
    }
    accumulatedTransfers[transfer.tokenAddress].amount += transfer.parsedAmount;
  }

  return Object.entries(accumulatedTransfers).map(([address, detail]) => ({
    address,
    symbol: detail.symbol,
    amount: detail.amount,
  }));
}

function calculateNetWin(
  extractedValue: { address: string; symbol: string; amount: number }[],
  bribe: number,
  gasCostETH: number
): { address: string; symbol: string; amount: number }[] {
  let ethPresent = false;

  const newNetWin = extractedValue.map((item) => {
    const isEth = item.symbol === 'ETH' || item.address.toLowerCase() === ETH_ADDRESS.toLowerCase();
    if (isEth) {
      ethPresent = true;
      // Subtracting both bribe and gasCostETH from the amount of ETH
      return { ...item, amount: item.amount - bribe - gasCostETH };
    }
    return item; // For non-ETH tokens, return as it is
  });

  // If there was no ETH in extractedValue, but there are ETH costs, include them as negative value
  if (!ethPresent && (bribe > 0 || gasCostETH > 0)) {
    newNetWin.push({ address: ETH_ADDRESS, symbol: 'ETH', amount: -(bribe + gasCostETH) });
  }

  return newNetWin;
}

export async function calculateGasInfo(
  txHash: string,
  transactionDetails: TransactionDetails
): Promise<{ gasUsed: number; gasPrice: number; gasCostETH: number }> {
  const gasUsedResult = await getGasUsedFromReceipt(txHash);
  const gasPriceResult = extractGasPrice(transactionDetails);

  if (!gasUsedResult) {
    throw new Error('Failed to retrieve gasUsed from receipt');
  }

  if (!gasPriceResult) {
    throw new Error('Failed to retrieve gasPrice from transaction details');
  }

  const gasUsed = parseInt(gasUsedResult, 10);
  const gasPrice = parseInt(gasPriceResult, 10);
  const gasCostETH = (gasUsed * gasPrice) / 1e18;

  return { gasUsed, gasPrice, gasCostETH };
}

export async function getTransactionCostInUSD(txHash: string): Promise<number | null> {
  const txId = await getTxIdByTxHash(txHash);
  if (!txId) return null;
  const transactionDetails = await getTransactionDetails(txId);

  const gasUsedResult = await getGasUsedFromReceipt(txHash);
  const gasPriceResult = extractGasPrice(transactionDetails);

  if (!gasUsedResult) return null;

  if (!gasPriceResult) return null;

  const gasUsed = parseInt(gasUsedResult, 10);
  const gasPrice = parseInt(gasPriceResult, 10);
  const gasCostETH = (gasUsed * gasPrice) / 1e18;
  const blockNumber = await getBlockNumberFromTxId(txId);
  if (!blockNumber) return null;
  let unixtime = await getTimestampByBlockNumber(blockNumber);
  if (!unixtime) {
    unixtime = await getBlockTimeStampFromNode(blockNumber);
  }
  if (!unixtime) return null;
  const ethInUsd = await getEthPriceWithTimestampFromTable(unixtime);
  if (!ethInUsd) return null;

  return gasCostETH * ethInUsd;
}

export async function getGasPriceInGwei(txHash: string): Promise<number | null> {
  const txId = await getTxIdByTxHash(txHash);
  if (!txId) return null;
  const transactionDetails = await getTransactionDetails(txId);

  const gasPriceResult = extractGasPrice(transactionDetails);

  if (!gasPriceResult) return null;

  const gasPrice = parseInt(gasPriceResult, 10);
  return gasPrice / 1e9;
}

export async function formatArbitrageCaseValueStaysWithFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string
): Promise<FormattedArbitrageResult> {
  const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);

  const bribe = calculateBribeAmoundForMoreThanOneBribe(cleanedTransfers, from, to);

  // Adjusting extractedValue to include bribe
  const extractedValue = calculateExtractedValueCaseValueStaysWithFromOrTo(
    [...balanceChangeFrom, ...balanceChangeTo],
    bribe.amount
  );

  const netWin = calculateNetWin(extractedValue, bribe.amount, gasCostETH);

  return {
    bribe,
    extractedValue,
    txGas: { gasUsed, gasPrice, gasCostETH },
    netWin,
    blockBuilder: bribe.blockBuilder,
  };
}

export function tryToExtractBribe(cleanedTransfers: ReadableTokenTransfer[]): {
  address: string;
  symbol: string;
  amount: number;
  blockBuilder: string | null;
} {
  const len = cleanedTransfers.length;

  // Check if there are at least 2 transfers and the last two are ETH transfers.
  let amount;
  if (len >= 2 && cleanedTransfers[len - 2].tokenSymbol === 'ETH' && cleanedTransfers[len - 1].tokenSymbol === 'ETH') {
    amount = cleanedTransfers[len - 2].parsedAmount;
  } else {
    amount = 0;
  }

  return {
    address: cleanedTransfers[len - 2].tokenAddress,
    symbol: 'ETH',
    amount: amount,
    blockBuilder: cleanedTransfers[len - 2].to,
  };
}

export async function formatArbitrageCaseValueGoesOutsideFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  from: string,
  to: string
): Promise<FormattedArbitrageResult | null> {
  const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);

  const bribe = tryToExtractBribe(cleanedTransfers);
  const extractedValue = calculateExtractedValueCaseValueGoesOutsideFromOrTo(cleanedTransfers, from, to);
  if (!extractedValue) return null;

  let netWin = calculateNetWin(extractedValue, bribe.amount, gasCostETH);

  return {
    bribe,
    extractedValue,
    txGas: { gasUsed, gasPrice, gasCostETH },
    netWin,
    blockBuilder: null,
  };
}

/**
 * Determines if a transaction was an atomic arbitrage.
 *
 * An atomic arbitrage is identified when a bot (or an entity)
 * executes a series of swaps (potentially involving multi-step swaps),
 * and ends up with the same token it initially sold.
 *
 * @param transfersCategorized - The categorized transfers of the transaction.
 * @param fromAddress - The address initiating the swaps.
 * @param calledContractAddress - The address of the potentially arbitraging bot/contract.
 * @returns True if an atomic arbitrage is detected, otherwise false.
 */
export async function wasTxAtomicArb(
  transfersCategorized: CategorizedTransfers,
  fromAddress: string,
  calledContractAddress: string
): Promise<boolean> {
  if (calledContractAddress.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) return false;

  const normalizedCalledContractAddress = calledContractAddress.toLowerCase();
  const normalizedFromAddress = fromAddress.toLowerCase();

  // Merge and sort swaps and multiStepSwaps based on the first transfer's position in each group
  let allSwaps = transfersCategorized.swaps
    .concat(transfersCategorized.multiStepSwaps)
    .sort((a, b) => (a[0]?.position || 0) - (b[0]?.position || 0));

  let initialTokenSold: string | null = null;
  let involvedSwaps: any[] = [];

  for (const swapGroup of allSwaps) {
    let involvedInThisSwap = false;
    for (const swap of swapGroup) {
      if (
        (swap.from.toLowerCase() === normalizedCalledContractAddress &&
          swap.to.toLowerCase() !== normalizedFromAddress) ||
        (swap.to.toLowerCase() === normalizedCalledContractAddress && swap.from.toLowerCase() !== normalizedFromAddress)
      ) {
        involvedInThisSwap = true;
        involvedSwaps.push(swap);
        if (swap.from.toLowerCase() === normalizedCalledContractAddress) {
          if (!initialTokenSold) {
            initialTokenSold = swap.tokenAddress.toLowerCase();
          }
        }
      }
    }
  }

  if (!initialTokenSold || involvedSwaps.length < 2) {
    return false;
  }

  // Checking for repurchase in the last swap
  const lastSwapGroup = allSwaps[allSwaps.length - 1];
  for (const swap of lastSwapGroup) {
    if (
      swap.to.toLowerCase() === normalizedCalledContractAddress &&
      swap.tokenAddress.toLowerCase() === initialTokenSold
    ) {
      return true;
    }
  }

  return false;
}

export async function augmentWithUSDValuesCaseValueStaysWithFromOrTo(
  formattedArbitrageResult: FormattedArbitrageResult,
  block_unixtime: number
): Promise<USDValuedArbitrageResult | null> {
  const uniqueTokens = new Set<string>([ETH_ADDRESS]);

  formattedArbitrageResult.extractedValue.forEach((item) => uniqueTokens.add(item.address));

  if (Array.isArray(formattedArbitrageResult.bribe)) {
    (formattedArbitrageResult.bribe as Array<{ address: string }>).forEach((item) => uniqueTokens.add(item.address));
  }
  if (Array.isArray(formattedArbitrageResult.netWin)) {
    (formattedArbitrageResult.netWin as Array<{ address: string }>).forEach((item) => uniqueTokens.add(item.address));
  }

  // Fetching unique prices
  let prices: Map<string, number> = new Map();

  for (const token of uniqueTokens) {
    const tokenId = await getCoinIdByAddress(token);
    if (!tokenId) continue;
    const price = await getTokenPriceWithTimestampFromDb(tokenId, block_unixtime);
    if (price !== null) {
      prices.set(token.toLowerCase(), price);
    }
  }

  if (!prices) {
    console.error('Failed to fetch prices for tokens: ', Array.from(uniqueTokens));
    return null;
  }

  const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
  if (!ethPrice) {
    console.error('Failed to fetch the price for ETH');
    return null;
  }

  const calculateUsdValue = (item: { address: string; symbol: string; amount: number }) => {
    const price = prices.get(item.address.toLowerCase());
    if (price === undefined) {
      return null;
    }
    return { ...item, amountInUSD: item.amount * price };
  };

  const extractedValue = formattedArbitrageResult.extractedValue.map(calculateUsdValue);
  if (extractedValue.includes(null)) return null;

  const bribeAmount = (formattedArbitrageResult.bribe as { address: string; symbol: string; amount: number }).amount;

  const netWin = (formattedArbitrageResult.netWin as Array<{ address: string; symbol: string; amount: number }>).map(
    calculateUsdValue
  );
  if (netWin.includes(null)) return null;

  const roundUSD = (value: number) => +value.toFixed(2);

  return {
    ethPrice: ethPrice,
    bribeInETH: bribeAmount,
    bribeInUSD: roundUSD(bribeAmount * ethPrice),
    fullCostETH: bribeAmount + formattedArbitrageResult.txGas.gasCostETH,
    fullCostUSD: roundUSD((bribeAmount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
    extractedValue: extractedValue.map((item) =>
      item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null
    ) as any,
    netWin: netWin.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any,
    txGas: {
      ...formattedArbitrageResult.txGas,
      gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice),
    },
    blockBuilder: formattedArbitrageResult.blockBuilder,
  };
}

function isUnknown<T>(value: T | 'unknown'): value is 'unknown' {
  return value === 'unknown';
}

export async function augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
  formattedArbitrageResult: FormattedArbitrageResult,
  block_unixtime: number
): Promise<USDValuedArbitrageResult | null> {
  const uniqueTokens = new Set<string>([ETH_ADDRESS]);

  if (!isUnknown(formattedArbitrageResult.extractedValue)) {
    formattedArbitrageResult.extractedValue.forEach((item) => uniqueTokens.add(item.address));
  }

  // Fetching unique prices
  let prices: Map<string, number> = new Map();

  for (const token of uniqueTokens) {
    const tokenId = await getCoinIdByAddress(token);
    if (!tokenId) continue;
    const price = await getTokenPriceWithTimestampFromDb(tokenId, block_unixtime);
    if (price !== null) {
      prices.set(token.toLowerCase(), price);
    }
  }

  if (!prices) {
    console.error('Failed to fetch prices for tokens: ', Array.from(uniqueTokens));
    return null;
  }

  const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
  if (!ethPrice) {
    console.error('Failed to fetch the price for ETH');
    return null;
  }

  const calculateUsdValue = (item: { address: string; symbol: string; amount: number }) => {
    const price = prices.get(item.address.toLowerCase());
    if (price === undefined) {
      return null;
    }
    return { ...item, amountInUSD: item.amount * price };
  };

  const extractedValue = !isUnknown(formattedArbitrageResult.extractedValue)
    ? formattedArbitrageResult.extractedValue.map(calculateUsdValue)
    : 'unknown';

  const netWin = !isUnknown(formattedArbitrageResult.netWin)
    ? formattedArbitrageResult.netWin.map(calculateUsdValue)
    : 'unknown';

  const roundUSD = (value: number) => +value.toFixed(2);

  return {
    ethPrice: ethPrice,
    bribeInETH: isUnknown(formattedArbitrageResult.bribe) ? 'unknown' : formattedArbitrageResult.bribe.amount,
    bribeInUSD: isUnknown(formattedArbitrageResult.bribe)
      ? 'unknown'
      : roundUSD(formattedArbitrageResult.bribe.amount * ethPrice),
    fullCostETH: isUnknown(formattedArbitrageResult.bribe)
      ? 'unknown'
      : formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH,
    fullCostUSD: isUnknown(formattedArbitrageResult.bribe)
      ? 'unknown'
      : roundUSD((formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
    extractedValue:
      extractedValue !== 'unknown'
        ? (extractedValue.map((item) =>
            item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null
          ) as any)
        : 'unknown',
    netWin:
      netWin !== 'unknown'
        ? (netWin.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any)
        : 'unknown',
    txGas: {
      ...formattedArbitrageResult.txGas,
      gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice),
    },
    blockBuilder: isUnknown(formattedArbitrageResult.bribe) ? 'unknown' : formattedArbitrageResult.blockBuilder,
  };
}

export function calculateProfitDetails(
  usdValuedArbitrageResult: USDValuedArbitrageResult,
  dollarValueInflowFromLeaf: number
): ProfitDetails | null {
  let netWin: number | 'unknown' = 'unknown';
  let revenue: number | 'unknown' = 'unknown';
  let totalCost: number | 'unknown' = 'unknown';

  if (Array.isArray(usdValuedArbitrageResult.netWin)) {
    const validNetWinEntries = usdValuedArbitrageResult.netWin.filter((entry) => entry && entry.amountInUSD != null);
    netWin = validNetWinEntries.reduce((acc, cur) => acc + cur.amountInUSD, 0);
  }

  if (Array.isArray(usdValuedArbitrageResult.extractedValue)) {
    const validRevenueEntries = usdValuedArbitrageResult.extractedValue.filter(
      (entry) => entry && entry.amountInUSD != null
    );
    revenue = validRevenueEntries.reduce((acc, cur) => acc + cur.amountInUSD, 0);
  }

  if (typeof revenue === 'number') {
    revenue -= dollarValueInflowFromLeaf;
    if (revenue < 0) return null;
  }

  if (typeof netWin === 'number') {
    netWin -= dollarValueInflowFromLeaf;
  }

  const {
    bribeInUSD,
    txGas: { gasCostUSD, gasPrice },
  } = usdValuedArbitrageResult;

  if (typeof bribeInUSD === 'number' && typeof gasCostUSD === 'number') {
    totalCost = bribeInUSD + gasCostUSD;
  }

  return {
    netWin,
    revenue,
    bribe: bribeInUSD,
    gas: gasCostUSD,
    gasInGwei: gasPrice,
    totalCost,
    blockBuilder: usdValuedArbitrageResult.blockBuilder,
  };
}

function printProfitDetails(profitDetails: ProfitDetails, txHash: string) {
  console.log(`\nTxHash ${txHash}`);
  console.log(
    `Net Win: ${typeof profitDetails.netWin === 'number' ? '$' + profitDetails.netWin.toFixed(2) : profitDetails.netWin}`
  );
  console.log(
    `Revenue: ${typeof profitDetails.revenue === 'number' ? '$' + profitDetails.revenue.toFixed(2) : profitDetails.revenue}`
  );
  console.log(
    `Bribe: ${typeof profitDetails.bribe === 'number' ? '$' + profitDetails.bribe.toFixed(2) : profitDetails.bribe}`
  );
  console.log(`Gas: $${profitDetails.gas.toFixed(2)}`);
  console.log(
    `Total Cost: ${typeof profitDetails.totalCost === 'number' ? '$' + profitDetails.totalCost.toFixed(2) : profitDetails.totalCost}`
  );
}

export async function getValidatorPayOff(txHash: string): Promise<number | null> {
  const blockNumber = await getBlockNumberByTxHash(txHash);
  if (!blockNumber) return null;

  const lastTxValue = await getLastTxValue(blockNumber);
  return lastTxValue;
}

export async function getBlockBuilderAddress(txHash: string): Promise<string | null> {
  const blockNumber = await getBlockNumberByTxHash(txHash);
  if (!blockNumber) return null;

  const lastTxFrom = await getBlockBuilderFromBlockNumber(blockNumber);
  return lastTxFrom;
}

export async function checkCaseValueStaysWithFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string
): Promise<FormattedArbitrageResult | null> {
  const txWasAtomicArb = isAtomicArbCaseValueStaysWithFromOrTo(
    cleanedTransfers,
    balanceChangeFrom,
    balanceChangeTo,
    from,
    to
  );
  if (!txWasAtomicArb) {
    return null;
  }

  const formattedArbitrage = await formatArbitrageCaseValueStaysWithFromOrTo(
    cleanedTransfers,
    txHash,
    transactionDetails,
    balanceChangeFrom,
    balanceChangeTo,
    from,
    to
  );
  return formattedArbitrage;
}

export function hasEnoughSwaps(balanceChangeTo: BalanceChange[], cleanedTransfers: ReadableTokenTransfer[]): boolean {
  if (balanceChangeTo.length === 0) return true;

  for (const change of balanceChangeTo) {
    let normalizedTokenSymbol = change.tokenSymbol;
    if (normalizedTokenSymbol === 'WETH') normalizedTokenSymbol = 'ETH';

    const transfersWithTokenSymbol = cleanedTransfers.filter((transfer) => {
      let transferToken = transfer.tokenSymbol;
      if (transferToken === 'WETH') transferToken = 'ETH';
      return transferToken === normalizedTokenSymbol;
    });

    if (transfersWithTokenSymbol.length >= 2) {
      return true;
    }
  }
  return false;
}

/**
 * Removes false duplicate ETH transfers from the array based on the provided address,
 * amount, and sender. If two transfers have the same sender, amount, and receiver,
 * the one with the smaller position is removed.
 *
 * @param cleanedTransfers - Array of ReadableTokenTransfer objects.
 * @param from - The address to check as the receiver of ETH transfers.
 * @returns A new array with false duplicates removed.
 */
export function removeFalseDupes(cleanedTransfers: ReadableTokenTransfer[], from: string): ReadableTokenTransfer[] {
  // Filter transfers where 'from' is the receiver and token is ETH
  const fromLowerCase = from.toLowerCase();

  // Filter transfers where 'from' is the receiver and token is ETH
  const relevantTransfers = cleanedTransfers.filter(
    (t) => t.to && t.to.toLowerCase() === fromLowerCase && t.tokenSymbol === 'ETH'
  );

  // Group transfers by sender and amount, case-insensitive for 'from'
  const groups: { [key: string]: ReadableTokenTransfer[] } = {};
  relevantTransfers.forEach((transfer) => {
    const key = `${transfer.from.toLowerCase()}_${transfer.parsedAmount}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(transfer);
  });

  // Remove duplicates with smaller position
  Object.values(groups).forEach((group) => {
    if (group.length === 2) {
      const transferToRemove = group[0].position! < group[1].position! ? group[0] : group[1];
      const index = cleanedTransfers.indexOf(transferToRemove);
      if (index !== -1) {
        cleanedTransfers.splice(index, 1);
      }
    }
  });

  return cleanedTransfers;
}

export function toHasInflowFromLeafOtherThanFrom(
  cleanedTransfers: ReadableTokenTransfer[],
  fromAddress: string,
  toAddress: string
): boolean {
  const fromAddressLowerCase = fromAddress.toLowerCase();
  const toAddressLowerCase = toAddress.toLowerCase();

  const transfersExcludingFrom = cleanedTransfers.filter(
    (t) =>
      t.from && t.from.toLowerCase() !== fromAddressLowerCase && t.to && t.to.toLowerCase() !== fromAddressLowerCase
  );

  return transfersExcludingFrom.some((transfer) => {
    if (transfer.to && transfer.to.toLowerCase() === toAddressLowerCase) {
      const transfersExcludingCurrent = transfersExcludingFrom.filter((t) => t !== transfer);
      return isLeaf(transfer.from, transfersExcludingCurrent);
    }
    return false;
  });
}

// Function to check if an address is a leaf in the entire transfers array
export function isLeaf(address: string, transfers: ReadableTokenTransfer[]): boolean {
  const addressToCheck = address.toLowerCase();

  return !transfers.some((t) => t.to.toLowerCase() === addressToCheck || t.from.toLowerCase() === addressToCheck);
}

// Function to check if a transfer has a leaf origin using isLeaf function
function hasLeafOrigin(transfer: ReadableTokenTransfer, transfers: ReadableTokenTransfer[]): boolean {
  return isLeaf(transfer.from, transfers);
}

// Function to count the number of transfers with leaf origins
function countLeafOrigins(
  filteredOnlyToTransfers: ReadableTokenTransfer[],
  allTransfers: ReadableTokenTransfer[]
): number {
  return filteredOnlyToTransfers.filter((t) => hasLeafOrigin(t, allTransfers)).length;
}

export async function isMakerProxy(contractAddress: string): Promise<boolean> {
  const abi = await readAbiFromAbisEthereumTable(contractAddress);
  if (!abi) {
    return false;
  }

  const requiredFunctions = ['cache', 'owner', 'authority'];
  return requiredFunctions.every((funcName) =>
    abi.some((item) => item.type === 'function' && item.name === funcName && item.stateMutability === 'view')
  );
}

export function hasMissmatchingForOriginLeafesToTo(
  onlyToTransfers: ReadableTokenTransfer[],
  allTransfers: ReadableTokenTransfer[],
  formAddress: string
): boolean {
  const fromAddressLowerCase = formAddress.toLowerCase();
  const filteredOnlyToTransfers = onlyToTransfers.filter((t) => t.from.toLowerCase() !== fromAddressLowerCase);

  const numOfLeafOrigins = countLeafOrigins(filteredOnlyToTransfers, allTransfers);
  return numOfLeafOrigins > 0;
}

export function wasDsProxy(cleanedTransfers: ReadableTokenTransfer[]): boolean {
  if (cleanedTransfers.length === 0) {
    return false;
  }

  const firstTransfer = cleanedTransfers[0];
  return firstTransfer.from.toLowerCase() === NULL_ADDRESS && firstTransfer.tokenSymbol === 'DAI';
}

export function hasAtLeastTwoPairs(cleanedTransfers: ReadableTokenTransfer[]): boolean {
  const tokenCountMap: { [symbol: string]: number } = {};

  for (const transfer of cleanedTransfers) {
    if (!transfer.tokenSymbol) continue;
    if (tokenCountMap[transfer.tokenSymbol]) {
      tokenCountMap[transfer.tokenSymbol]++;
    } else {
      tokenCountMap[transfer.tokenSymbol] = 1;
    }
  }

  let tokensWithTwoOrMoreTransfers = 0;
  for (const count of Object.values(tokenCountMap)) {
    if (count >= 2) {
      tokensWithTwoOrMoreTransfers++;
    }
  }

  return tokensWithTwoOrMoreTransfers >= 2;
}

export async function checkCaseValueGoesOutsideFromOrTo(
  onlyToTransfers: ReadableTokenTransfer[],
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string,
  block_unixtime: number
): Promise<[FormattedArbitrageResult | null, number]> {
  const [isAtomicArb, value] = await isAtomicArbCaseValueGoesOutsideFromOrTo(
    onlyToTransfers,
    cleanedTransfers,
    balanceChangeFrom,
    balanceChangeTo,
    from,
    to,
    block_unixtime
  );
  if (!isAtomicArb) {
    return [null, 0];
  }

  const formattedArbitrage = await formatArbitrageCaseValueGoesOutsideFromOrTo(
    cleanedTransfers,
    txHash,
    transactionDetails,
    from,
    to
  );

  return [formattedArbitrage, value];
}

export function testOtherBribePath(
  usdValuedArbitrageResult: USDValuedArbitrageResult,
  cleanedTransfers: ReadableTokenTransfer[],
  from: string,
  to: string,
  formattedArbitrageResult: FormattedArbitrageResult
): FormattedArbitrageResult {
  if (Array.isArray(usdValuedArbitrageResult.netWin) && usdValuedArbitrageResult.fullCostUSD !== 'unknown') {
    // Filter out any null entries before performing the reduce operation
    const validEntries = usdValuedArbitrageResult.netWin.filter((entry) => entry && entry.amountInUSD != null);

    // Calculate the sum of amountInUSD in the netWin array
    const sumAmountInUSD = validEntries.reduce((acc, entry) => acc + entry.amountInUSD, 0);

    // If there appears to be a net loss, re-visit bribe logic
    if (sumAmountInUSD < 0) {
      // updating bribe
      const bribe = calculateBribeAmoundForSingleBribe(cleanedTransfers, from, to);
      if (bribe.amount === 0) return formattedArbitrageResult;

      formattedArbitrageResult.bribe = bribe;

      // updating netWin
      const netWin = calculateNetWin(
        formattedArbitrageResult.extractedValue,
        bribe.amount,
        formattedArbitrageResult.txGas.gasCostETH
      );
      formattedArbitrageResult.netWin = netWin;
    }
  }

  return formattedArbitrageResult;
}

export function hasExternalTokenInflow(
  onlyToTransfers: ReadableTokenTransfer[],
  toAddress: string,
  fromAddress: string
): boolean {
  const fromAddressLowerCase = fromAddress.toLowerCase();
  const toAddressLowerCase = toAddress.toLowerCase();

  // Ensure transfers do not involve fromAddress
  onlyToTransfers = onlyToTransfers.filter(
    (t) =>
      t.to && t.to.toLowerCase() !== fromAddressLowerCase && t.from && t.from.toLowerCase() !== fromAddressLowerCase
  );

  if (onlyToTransfers.length !== 3) return false;

  // Filter transfers involving toAddress
  const relatedTransfers = onlyToTransfers.filter(
    (t) =>
      (t.to && t.to.toLowerCase() === toAddressLowerCase) || (t.from && t.from.toLowerCase() === toAddressLowerCase)
  );

  // Finding one transfer where toAddress is the receiver
  const receivedTransfer = relatedTransfers.find((t) => t.to && t.to.toLowerCase() === toAddressLowerCase);
  if (!receivedTransfer) return false;

  // One where toAddress is the sender of the same token and amount
  const sentTransfer = relatedTransfers.find(
    (t) =>
      t.from &&
      t.from.toLowerCase() === toAddressLowerCase &&
      t.tokenAddress.toLowerCase() === receivedTransfer.tokenAddress.toLowerCase() &&
      t.parsedAmount === receivedTransfer.parsedAmount
  );
  if (!sentTransfer) return false;

  // Ensure there's a third transfer where toAddress is the receiver but with a different token
  const otherReceivedTransfer = onlyToTransfers.find(
    (t) =>
      t.to &&
      t.to.toLowerCase() === toAddressLowerCase &&
      t.tokenAddress.toLowerCase() !== receivedTransfer.tokenAddress.toLowerCase()
  );
  if (!otherReceivedTransfer) return false;

  return true;
}

export const is1InchInvolvedInTransfers = (transfers: ReadableTokenTransfer[]): boolean => {
  return transfers.some((transfer) => {
    const from = transfer.from?.toLowerCase();
    const to = transfer.to?.toLowerCase();

    const oneInchLower = ONEINCH_ADDRESS.toLowerCase();

    return from === oneInchLower || to === oneInchLower;
  });
};

export const highestBlockPositionWorthChecking = 35;

export async function solveAtomicArb(
  txId: number,
  txHash: string,
  cleanedTransfers: ReadableTokenTransfer[],
  from: string,
  to: string
): Promise<TransactionDetailsForAtomicArbs | null | 'not an arb'> {
  const txHasAtLeastTwoPairs = hasAtLeastTwoPairs(cleanedTransfers);
  if (!txHasAtLeastTwoPairs) {
    return 'not an arb';
  }

  const OneInchInvolvedInTransfers = is1InchInvolvedInTransfers(cleanedTransfers);
  if (OneInchInvolvedInTransfers) {
    return 'not an arb';
  }

  const onlyToTransfers = filterTransfersByAddress(cleanedTransfers, to);
  if (!onlyToTransfers) {
    return null;
  }

  if (!onlyToTransfers.some((t) => t.position! <= 5)) {
    return 'not an arb';
  }

  if (onlyToTransfers.length <= 2) {
    return 'not an arb';
  }

  const txWasDsProxy = wasDsProxy(cleanedTransfers);
  if (txWasDsProxy) {
    return 'not an arb';
  }

  if (hasMissmatchingForOriginLeafesToTo(onlyToTransfers, cleanedTransfers, from)) {
    return 'not an arb';
  }

  if (toHasInflowFromLeafOtherThanFrom(cleanedTransfers, from, to)) {
    return 'not an arb';
  }

  cleanedTransfers = removeFalseDupes(cleanedTransfers, from);

  const balanceChangeFrom = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);

  const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);

  if (!hasEnoughSwaps(balanceChangeTo, cleanedTransfers)) {
    return 'not an arb';
  }

  if (balanceChangeTo.length > 8) {
    return 'not an arb';
  }

  if (to.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) {
    return 'not an arb';
  }

  /*
  sandwichs' backrun can look like arb: 0x1a4f25133a15c5d226b291e9c5751d910ac1ca796c151f6bc917f3c65a69d340
  removing that, since its accounted for as sandwich.
  only finds frontruns which occured on curve (easy look up in local db), a
  global check (which takes longer) happens later down the code, when the chances are higher we have an actual arb.
  */
  const isBackrunViaLocalCheck = await isActuallyBackrun(txId);
  if (isBackrunViaLocalCheck) {
    return 'not an arb';
  }

  if (hasExternalTokenInflow(onlyToTransfers, to, from)) {
    return 'not an arb';
  }

  const transactionDetails = await getTransactionDetailsByTxId(txId);
  if (!transactionDetails) {
    console.log('!transactionDetails in getTransactionDetailsByTxId in solveAtomicArb');
    return null;
  }

  const blockPosition = transactionDetails.transactionIndex;
  if (blockPosition > highestBlockPositionWorthChecking) {
    return 'not an arb';
  }

  // Case 1: checking for the atomic arb case in which the profit stays in the bot/bot-operator system
  // Case 2: as in: is not checking for the atomic arb case in which the profit gets forwarded to a 3rd address

  // checking case 1
  let formattedArbitrage = await checkCaseValueStaysWithFromOrTo(
    cleanedTransfers,
    txHash,
    transactionDetails,
    balanceChangeFrom,
    balanceChangeTo,
    from,
    to
  );
  let usdValuedArbitrageResult;

  const transaction = await Transactions.findOne({
    where: { tx_hash: { [Op.iLike]: txHash } },
  });

  if (!transaction) throw new Error(`Transaction not found for hash: ${txHash}`);
  const block_unixtime = transaction.block_unixtime;

  let revenueStorageLocationCase;

  /*
    this dollar Value is storing the usd value, 
    in case there was a value transfer in the first transfer from a leaf to toAddress
    */
  let dollarValueInflowFromLeaf = 0;

  // (If case 1)
  if (formattedArbitrage) {
    usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
    revenueStorageLocationCase = 1;
  } else {
    // If it is not case 1, check for case 2
    [formattedArbitrage, dollarValueInflowFromLeaf] = await checkCaseValueGoesOutsideFromOrTo(
      onlyToTransfers,
      cleanedTransfers,
      txHash,
      transactionDetails,
      balanceChangeFrom,
      balanceChangeTo,
      from,
      to,
      block_unixtime
    );

    if (formattedArbitrage) {
      usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
        formattedArbitrage,
        block_unixtime
      );
      revenueStorageLocationCase = 2;
    }
  }

  // if formattedArbitrage is empty after checking for both cases, it is not an atomic arbitrage.
  if (!formattedArbitrage) {
    // console.log("Not Atomic Arbitrage!");
    return 'not an arb';
  }

  if (!usdValuedArbitrageResult) {
    return 'not an arb';
  }

  // checking for the case in which there was a bribe, and the rev went to an external address as well
  formattedArbitrage = testOtherBribePath(usdValuedArbitrageResult, cleanedTransfers, from, to, formattedArbitrage);

  if (revenueStorageLocationCase === 1) {
    usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
  } else if (revenueStorageLocationCase === 2) {
    usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
      formattedArbitrage,
      block_unixtime
    );
  } else {
    console.log('something funny with revenueStorageLocationCase');
    return null;
  }

  if (!usdValuedArbitrageResult) {
    // console.log("Skipping usdValuedArbitrageResult due to failed price fetching.");
    return 'not an arb';
  }

  // 68 ms
  if (await isMakerProxy(to)) {
    return 'not an arb';
  }

  // 600 ms
  const isBackrun = await isGlobalBackrun(transaction, txId);
  if (isBackrun) {
    // at this point we can be sure we found a sandwich, in which only the backrun went at some point through a curve pool,
    // , but the frontrun and the victim tx never did.
    return 'not an arb';
  }

  // console.log("\n\nusdValuedArbitrageResult:", usdValuedArbitrageResult, "\nid", txId, "\ntxHash", txHash);

  const profitDetails = calculateProfitDetails(usdValuedArbitrageResult, dollarValueInflowFromLeaf);
  if (!profitDetails) {
    console.log('!profitDetails in solveAtomicArb');
    return null;
  }

  let validatorPayOffInEth: number | null = null;
  let validatorPayOffInUSD: number | null = null;
  if (profitDetails.bribe) {
    validatorPayOffInEth = await getValidatorPayOff(txHash);
    if (validatorPayOffInEth && usdValuedArbitrageResult.ethPrice) {
      validatorPayOffInUSD = validatorPayOffInEth * usdValuedArbitrageResult.ethPrice;
    }
  }

  // 57 ms
  const atomicArbDetails = await buildAtomicArbDetails(txId, profitDetails, validatorPayOffInUSD);
  if (!atomicArbDetails) {
    console.log('!atomicArbDetails in solveAtomicArb');
    return null;
  }

  // const arbDetailsWithSpotPriceUpdate = await solveSpotPriceUpdate(atomicArbDetails); // on hold, since big

  return atomicArbDetails;
}
