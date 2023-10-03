import { toArray } from "cheerio/lib/api/traversing.js";
import { TransactionDetails } from "../../../../../models/TransactionDetails.js";
import { BalanceChange, CategorizedTransfers, FormattedArbitrageResult, ProfitDetails, ReadableTokenTransfer, USDValuedArbitrageResult } from "../../../../Interfaces.js";
import { CoWProtocolGPv2Settlement, ETH_ADDRESS, WETH_ADDRESS } from "../../../../helperFunctions/Constants.js";
import { getGasUsedFromReceipt } from "../../../readFunctions/Receipts.js";
import { extractGasPrice, getTransactionDetailsByTxHash } from "../../../readFunctions/TransactionDetails.js";
import { Transactions } from "../../../../../models/Transactions.js";
import { Op } from "sequelize";
import { getHistoricalTokenPriceFromDefiLlama, getPricesForAllTokensFromDefiLlama } from "../../txValue/DefiLlama.js";

export async function getBalanceChangeForAddressFromTransfers(walletAddress: string, cleanedTransfers: ReadableTokenTransfer[]): Promise<BalanceChange[]> {
  const balances: { [key: string]: { symbol: string; amount: number } } = {};

  cleanedTransfers.forEach((transfer) => {
    // If the address is involved in the transaction
    if (transfer.from.toLowerCase() === walletAddress.toLowerCase() || transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
      const address = transfer.tokenAddress;
      const symbol = transfer.tokenSymbol || "Unknown Token";

      if (!balances[address]) {
        balances[address] = { symbol: symbol, amount: 0 };
      }

      if (transfer.from.toLowerCase() === walletAddress.toLowerCase()) {
        balances[address].amount -= transfer.parsedAmount;
      }
      if (transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
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

const calculateBalanceChangesForMints = (liquidityPairs: ReadableTokenTransfer[][], calledContractAddress: string): BalanceChanges => {
  let balanceChange: BalanceChanges = {};
  const calledAddressLower = calledContractAddress.toLowerCase();

  liquidityPairs.forEach((pair) => {
    pair.forEach((mint, index) => {
      const address = mint.tokenAddress;
      const symbol = mint.tokenSymbol || "Unknown Token";

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

/**
 * all balance changes are positive
 * or
 * if outflowing eth, all other balance changes (of which there has to be at least one) are postive
 * and
 * there were balance changes at all
 * @param balanceChanges token balance changes for "from" and "to" (bot and bot operator)
 * @returns
 */
function isAtomicArbCaseValueStaysWithFromOrTo(balanceChanges: BalanceChange[]): boolean {
  if (balanceChanges.length === 0) return false;

  let hasNegativeEthChange = false;
  let hasPositiveChangeOtherThanETH = false;

  for (const change of balanceChanges) {
    if (change.tokenSymbol === "ETH" && change.balanceChange < 0) {
      hasNegativeEthChange = true;
    } else if (change.balanceChange <= 0) {
      // If there's any balance change that's non-positive and not the special ETH case, return false.
      return false;
    } else {
      hasPositiveChangeOtherThanETH = true;
    }
  }

  // If there's a negative ETH change, then there must also be a positive change of another token.
  if (hasNegativeEthChange) {
    return hasPositiveChangeOtherThanETH;
  }

  // If no negative ETH change was found, then it's enough that no balance change was negative.
  return true;
}

// New check for the case where value goes outside "from" and "to".
function isAtomicArbCaseValueGoesOutsideFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string
): boolean {
  // Check that from and to have no balance changes
  if (balanceChangeFrom.length !== 0 || balanceChangeTo.length !== 0) {
    return false;
  }

  // Check if there's a leaf that received something from "from" or "to" and is at the end of the transfers list
  let lastIndex = cleanedTransfers.length - 1;

  // While there's a valid transfer at the end, check the conditions
  while (lastIndex >= 0) {
    let transfer = cleanedTransfers[lastIndex];
    if (
      (transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase()) &&
      transfer.to.toLowerCase() !== from.toLowerCase() &&
      transfer.to.toLowerCase() !== to.toLowerCase()
    ) {
      return true; // Found a transfer where value moved outside of "from" and "to" at the end of the list
    }

    lastIndex--; // Move up the list to check the previous transfer
  }

  return false;
}

function convertWETHtoETHforBalanceChanges(balanceChanges: BalanceChanges): BalanceChanges {
  const updatedBalances: BalanceChanges = { ...balanceChanges };

  if (updatedBalances[WETH_ADDRESS]) {
    const wethAmount = updatedBalances[WETH_ADDRESS].amount;

    if (updatedBalances[ETH_ADDRESS]) {
      updatedBalances[ETH_ADDRESS].amount += wethAmount;
    } else {
      updatedBalances[ETH_ADDRESS] = { symbol: "ETH", amount: wethAmount };
    }

    delete updatedBalances[WETH_ADDRESS];
  }

  return updatedBalances;
}

export function marketArbitrageSection(readableTransfers: CategorizedTransfers, calledContractAddress: string): BalanceChanges {
  const calculateBalanceChangesForSwaps = (swaps: ReadableTokenTransfer[][], calledContractAddress: string): BalanceChanges => {
    let balanceChange: BalanceChanges = {};

    const calledAddressLower = calledContractAddress.toLowerCase();

    const calculateForSwap = (swap: ReadableTokenTransfer[]) => {
      for (const transfer of swap) {
        const address = transfer.tokenAddress;
        const symbol = transfer.tokenSymbol || "Unknown Token";

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
  const balanceChangeMultiStepSwaps = calculateBalanceChangesForSwaps(readableTransfers.multiStepSwaps, calledContractAddress);
  const balanceChangeMints = calculateBalanceChangesForMints(readableTransfers.liquidityPairs, calledContractAddress);

  // Combine balance changes
  const combinedBalanceChanges = mergeBalanceChanges(balanceChangeSwaps, balanceChangeMultiStepSwaps, balanceChangeMints);

  // sum WETH against ETH
  const finalBalanceChanges = convertWETHtoETHforBalanceChanges(combinedBalanceChanges);

  return finalBalanceChanges;
}

export function bribe(readableTransfers: CategorizedTransfers, from: string): { address: string; symbol: string; amount: number } {
  let totalOutflowingETH = 0;

  for (const transfer of readableTransfers.outflowingETH) {
    if (transfer.to.toLowerCase() === from.toLowerCase()) continue; // excluding eth being send from bot to bot owner from bribe amount
    totalOutflowingETH += transfer.parsedAmount;
  }

  return {
    address: ETH_ADDRESS,
    symbol: "ETH",
    amount: totalOutflowingETH,
  };
}

function convertWETHToETH(balanceChanges: BalanceChanges): BalanceChanges {
  let converted: BalanceChanges = {};

  for (const address in balanceChanges) {
    if (address.toLowerCase() === WETH_ADDRESS) {
      converted[ETH_ADDRESS] = { ...balanceChanges[address], symbol: "ETH" };
    } else {
      converted[address] = balanceChanges[address];
    }
  }

  return converted;
}

export function calculateNetWinOld(combinedBalanceChanges: BalanceChanges, bribe: { address: string; symbol: string; amount: number }, gasCostETH: number): BalanceChanges {
  let netWin: BalanceChanges = { ...combinedBalanceChanges };

  // Subtract bribe from WETH if exists
  if (netWin[WETH_ADDRESS]) {
    netWin[WETH_ADDRESS] = { ...netWin[WETH_ADDRESS], amount: netWin[WETH_ADDRESS].amount - bribe.amount };
  }
  // Subtract bribe from ETH if WETH doesn't exist
  else if (netWin[ETH_ADDRESS]) {
    netWin[ETH_ADDRESS] = { ...netWin[ETH_ADDRESS], amount: netWin[ETH_ADDRESS].amount - bribe.amount };
  }
  // Add negative bribe to ETH if neither exists
  else {
    netWin[ETH_ADDRESS] = { symbol: "ETH", amount: -bribe.amount };
  }

  // Convert WETH to ETH
  netWin = convertWETHToETH(netWin);

  // Subtract gasCostETH
  if (netWin[ETH_ADDRESS]) {
    netWin[ETH_ADDRESS] = { ...netWin[ETH_ADDRESS], amount: netWin[ETH_ADDRESS].amount - gasCostETH };
  }
  // If ETH doesn't exist in netWin after converting WETH, add negative gasCostETH to ETH
  else {
    netWin[ETH_ADDRESS] = { symbol: "ETH", amount: -gasCostETH };
  }

  return netWin;
}

// leafs which receive eth and are not bot (to) or botoperator (from)
function calculateBribe(transfers: ReadableTokenTransfer[], from: string, to: string): { address: string; symbol: string; amount: number } {
  let bribeAmount = 0;

  const isAddressInvolvedInOtherTransfers = (address: string, excludedTransferIndex: number): boolean => {
    return transfers.some((transfer, index) => {
      return index !== excludedTransferIndex && (transfer.from.toLowerCase() === address.toLowerCase() || transfer.to.toLowerCase() === address.toLowerCase());
    });
  };

  transfers.forEach((transfer, index) => {
    const lowerCaseFrom = transfer.from.toLowerCase();
    const lowerCaseReceiver = transfer.to.toLowerCase();

    if (transfer.tokenSymbol === "ETH" && (lowerCaseFrom === from.toLowerCase() || lowerCaseFrom === to.toLowerCase())) {
      if (!isAddressInvolvedInOtherTransfers(lowerCaseReceiver, index) && lowerCaseReceiver !== from.toLowerCase() && lowerCaseReceiver !== to.toLowerCase()) {
        bribeAmount += transfer.parsedAmount;
      }
    }
  });

  return {
    address: ETH_ADDRESS,
    symbol: "ETH",
    amount: bribeAmount,
  };
}

function calculateExtractedValueCaseValueStaysWithFromOrTo(balanceChanges: BalanceChange[], bribe: number): { address: string; symbol: string; amount: number }[] {
  let ethPresent = false;

  const newExtractedValue = balanceChanges.map((change) => {
    const isEth = change.tokenSymbol === "ETH" || change.tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase();
    if (isEth) {
      ethPresent = true;
      return { address: change.tokenAddress, symbol: "ETH", amount: change.balanceChange + bribe };
    }
    return { address: change.tokenAddress, symbol: change.tokenSymbol || "Unknown Token", amount: change.balanceChange };
  });

  if (!ethPresent && bribe > 0) {
    newExtractedValue.push({ address: ETH_ADDRESS, symbol: "ETH", amount: bribe });
  }

  return newExtractedValue;
}

function calculateExtractedValueCaseValueGoesOutsideFromOrTo(transfers: ReadableTokenTransfer[], from: string, to: string): { address: string; symbol: string; amount: number }[] {
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
      accumulatedTransfers[transfer.tokenAddress] = { symbol: transfer.tokenSymbol || "Unknown Token", amount: 0 };
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
    const isEth = item.symbol === "ETH" || item.address.toLowerCase() === ETH_ADDRESS.toLowerCase();
    if (isEth) {
      ethPresent = true;
      // Subtracting both bribe and gasCostETH from the amount of ETH
      return { ...item, amount: item.amount - bribe - gasCostETH };
    }
    return item; // For non-ETH tokens, return as it is
  });

  // If there was no ETH in extractedValue, but there are ETH costs, include them as negative value
  if (!ethPresent && (bribe > 0 || gasCostETH > 0)) {
    newNetWin.push({ address: ETH_ADDRESS, symbol: "ETH", amount: -(bribe + gasCostETH) });
  }

  return newNetWin;
}

async function calculateGasInfo(txHash: string, transactionDetails: TransactionDetails): Promise<{ gasUsed: number; gasPrice: number; gasCostETH: number }> {
  const gasUsedResult = await getGasUsedFromReceipt(txHash);
  const gasPriceResult = extractGasPrice(transactionDetails);

  if (!gasUsedResult) {
    throw new Error("Failed to retrieve gasUsed from receipt");
  }

  if (!gasPriceResult) {
    throw new Error("Failed to retrieve gasPrice from transaction details");
  }

  const gasUsed = parseInt(gasUsedResult, 10);
  const gasPrice = parseInt(gasPriceResult, 10);
  const gasCostETH = (gasUsed * gasPrice) / 1e18;

  return { gasUsed, gasPrice, gasCostETH };
}

async function getHistoricalPrices(tokens: BalanceChange[], timestamp: number): Promise<Map<string, number>> {
  const uniqueTokens = [...new Set(tokens.map((token) => token.tokenAddress))];
  const priceMap = new Map<string, number>();

  for (const token of uniqueTokens) {
    const price = await getHistoricalTokenPriceFromDefiLlama(token, timestamp);
    if (price !== null) priceMap.set(token.toLowerCase(), price);
  }

  return priceMap;
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
  const bribe = calculateBribe(cleanedTransfers, from, to);

  // Adjusting extractedValue to include bribe
  const extractedValue = calculateExtractedValueCaseValueStaysWithFromOrTo([...balanceChangeFrom, ...balanceChangeTo], bribe.amount);

  const netWin = calculateNetWin(extractedValue, bribe.amount, gasCostETH);

  return {
    bribe,
    extractedValue,
    txGas: { gasUsed, gasPrice, gasCostETH },
    netWin,
  };
}

export async function formatArbitrageCaseValueGoesOutsideFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  from: string,
  to: string
): Promise<FormattedArbitrageResult> {
  const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);

  const bribe = "unknown";
  const extractedValue = calculateExtractedValueCaseValueGoesOutsideFromOrTo(cleanedTransfers, from, to);
  const netWin = "unknown";

  return {
    bribe,
    extractedValue,
    txGas: { gasUsed, gasPrice, gasCostETH },
    netWin,
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
export async function wasTxAtomicArb(transfersCategorized: CategorizedTransfers, fromAddress: string, calledContractAddress: string): Promise<boolean> {
  if (calledContractAddress.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) return false;

  const normalizedCalledContractAddress = calledContractAddress.toLowerCase();
  const normalizedFromAddress = fromAddress.toLowerCase();

  // Merge and sort swaps and multiStepSwaps based on the first transfer's position in each group
  let allSwaps = transfersCategorized.swaps.concat(transfersCategorized.multiStepSwaps).sort((a, b) => (a[0]?.position || 0) - (b[0]?.position || 0));

  let initialTokenSold: string | null = null;
  let involvedSwaps: any[] = [];

  for (const swapGroup of allSwaps) {
    let involvedInThisSwap = false;
    for (const swap of swapGroup) {
      if (
        (swap.from.toLowerCase() === normalizedCalledContractAddress && swap.to.toLowerCase() !== normalizedFromAddress) ||
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
    if (swap.to.toLowerCase() === normalizedCalledContractAddress && swap.tokenAddress.toLowerCase() === initialTokenSold) {
      return true;
    }
  }

  return false;
}

async function augmentWithUSDValuesCaseValueStaysWithFromOrTo(
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
    const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);
    if (price !== null) {
      prices.set(token.toLowerCase(), price);
    }
  }

  if (!prices) {
    console.error("Failed to fetch prices for tokens: ", Array.from(uniqueTokens));
    return null;
  }

  const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
  if (!ethPrice) {
    console.error("Failed to fetch the price for ETH");
    return null;
  }

  const calculateUsdValue = (item: { address: string; symbol: string; amount: number }) => {
    const price = prices.get(item.address.toLowerCase());
    if (price === undefined) {
      console.error(`Failed to fetch the price for token: ${item.address}`);
      return null;
    }
    return { ...item, amountInUSD: item.amount * price };
  };

  const extractedValue = formattedArbitrageResult.extractedValue.map(calculateUsdValue);
  if (extractedValue.includes(null)) return null;

  const bribeAmount = (formattedArbitrageResult.bribe as { address: string; symbol: string; amount: number }).amount;

  const netWin = (formattedArbitrageResult.netWin as Array<{ address: string; symbol: string; amount: number }>).map(calculateUsdValue);
  if (netWin.includes(null)) return null;

  const roundUSD = (value: number) => +value.toFixed(2);

  return {
    bribeInETH: bribeAmount,
    bribeInUSD: roundUSD(bribeAmount * ethPrice),
    fullCostETH: bribeAmount + formattedArbitrageResult.txGas.gasCostETH,
    fullCostUSD: roundUSD((bribeAmount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
    extractedValue: extractedValue.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any,
    netWin: netWin.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any,
    txGas: { ...formattedArbitrageResult.txGas, gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice) },
  };
}

function isUnknown<T>(value: T | "unknown"): value is "unknown" {
  return value === "unknown";
}

async function augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
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
    const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);
    if (price !== null) {
      prices.set(token.toLowerCase(), price);
    }
  }

  if (!prices) {
    console.error("Failed to fetch prices for tokens: ", Array.from(uniqueTokens));
    return null;
  }

  const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
  if (!ethPrice) {
    console.error("Failed to fetch the price for ETH");
    return null;
  }

  const calculateUsdValue = (item: { address: string; symbol: string; amount: number }) => {
    const price = prices.get(item.address.toLowerCase());
    if (price === undefined) {
      console.error(`Failed to fetch the price for token: ${item.address}`);
      return null;
    }
    return { ...item, amountInUSD: item.amount * price };
  };

  const extractedValue = !isUnknown(formattedArbitrageResult.extractedValue) ? formattedArbitrageResult.extractedValue.map(calculateUsdValue) : "unknown";

  const netWin = !isUnknown(formattedArbitrageResult.netWin) ? formattedArbitrageResult.netWin.map(calculateUsdValue) : "unknown";

  const roundUSD = (value: number) => +value.toFixed(2);

  return {
    bribeInETH: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : formattedArbitrageResult.bribe.amount,
    bribeInUSD: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : roundUSD(formattedArbitrageResult.bribe.amount * ethPrice),
    fullCostETH: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH,
    fullCostUSD: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : roundUSD((formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
    extractedValue:
      extractedValue !== "unknown" ? (extractedValue.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any) : "unknown",
    netWin: netWin !== "unknown" ? (netWin.map((item) => (item ? { ...item, amountInUSD: roundUSD(item.amountInUSD as number) } : null)) as any) : "unknown",
    txGas: { ...formattedArbitrageResult.txGas, gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice) },
  };
}

function calculateProfitDetails(usdValuedArbitrageResult: USDValuedArbitrageResult): ProfitDetails {
  let netWin: number | "unknown" = "unknown";
  let revenue: number | "unknown" = "unknown";
  let totalCost: number | "unknown" = "unknown";

  if (Array.isArray(usdValuedArbitrageResult.netWin)) {
    netWin = usdValuedArbitrageResult.netWin.reduce((acc, cur) => acc + cur.amountInUSD, 0);
  }

  if (Array.isArray(usdValuedArbitrageResult.extractedValue)) {
    revenue = usdValuedArbitrageResult.extractedValue.reduce((acc, cur) => acc + cur.amountInUSD, 0);
  }

  const {
    bribeInUSD,
    txGas: { gasCostUSD },
  } = usdValuedArbitrageResult;

  if (typeof bribeInUSD === "number" && typeof gasCostUSD === "number") {
    totalCost = bribeInUSD + gasCostUSD;
  }

  return {
    netWin,
    revenue,
    bribe: bribeInUSD,
    gas: gasCostUSD,
    totalCost,
  };
}

function printProfitDetails(profitDetails: ProfitDetails) {
  console.log(`Net Win: ${typeof profitDetails.netWin === "number" ? "$" + profitDetails.netWin.toFixed(2) : profitDetails.netWin}`);
  console.log(`Revenue: ${typeof profitDetails.revenue === "number" ? "$" + profitDetails.revenue.toFixed(2) : profitDetails.revenue}`);
  console.log(`Bribe: ${typeof profitDetails.bribe === "number" ? "$" + profitDetails.bribe.toFixed(2) : profitDetails.bribe}`);
  console.log(`Gas: $${profitDetails.gas.toFixed(2)}`);
  console.log(`Total Cost: ${typeof profitDetails.totalCost === "number" ? "$" + profitDetails.totalCost.toFixed(2) : profitDetails.totalCost}`);
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
  const txWasAtomicArb = isAtomicArbCaseValueStaysWithFromOrTo([...balanceChangeFrom, ...balanceChangeTo]);

  if (!txWasAtomicArb) {
    return null;
  }

  const formattedArbitrage = await formatArbitrageCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
  return formattedArbitrage;
}

export async function checkCaseValueGoesOutsideFromOrTo(
  cleanedTransfers: ReadableTokenTransfer[],
  txHash: string,
  transactionDetails: TransactionDetails,
  balanceChangeFrom: BalanceChange[],
  balanceChangeTo: BalanceChange[],
  from: string,
  to: string
): Promise<FormattedArbitrageResult | null> {
  const txWasAtomicArb = isAtomicArbCaseValueGoesOutsideFromOrTo(cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to);

  if (!txWasAtomicArb) {
    return null;
  }

  const formattedArbitrage = await formatArbitrageCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, from, to);
  return formattedArbitrage;
}

export async function solveAtomicArb(txHash: string, cleanedTransfers: ReadableTokenTransfer[], from: string, to: string): Promise<void> {
  const transactionDetails = await getTransactionDetailsByTxHash(txHash!);
  if (!transactionDetails) return;

  if (to.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) {
    console.log("Not Atomic Arbitrage!");
    return;
  }

  const balanceChangeFrom = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);
  console.log("balanceChangeFrom (" + from + ")", balanceChangeFrom);

  const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);
  console.log("balanceChangeTo (" + to + ")", balanceChangeTo);

  let formattedArbitrage = await checkCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
  let usdValuedArbitrageResult;

  const transaction = await Transactions.findOne({
    where: { tx_hash: { [Op.iLike]: txHash } },
  });

  if (!transaction) throw new Error(`Transaction not found for hash: ${txHash}`);
  const block_unixtime = transaction.block_unixtime;

  if (formattedArbitrage) {
    // console.log("formattedArbitrage", formattedArbitrage);
    usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
  } else {
    formattedArbitrage = await checkCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
    // console.log("formattedArbitrage", formattedArbitrage);
    if (formattedArbitrage) {
      usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(formattedArbitrage, block_unixtime);
    }
  }

  if (!formattedArbitrage) {
    console.log("Not Atomic Arbitrage!");
    return;
  }

  if (!usdValuedArbitrageResult) {
    console.log("Skipping usdValuedArbitrageResult due to failed price fetching.");
    return;
  }
  console.log("\nusdValuedArbitrageResult:", usdValuedArbitrageResult);

  const profitDetails = calculateProfitDetails(usdValuedArbitrageResult);
  printProfitDetails(profitDetails);
}
