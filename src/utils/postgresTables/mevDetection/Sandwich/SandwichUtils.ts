import { Op } from "sequelize";
import { TransactionCoins } from "../../../../models/TransactionCoins.js";
import { TransactionData } from "../../../../models/Transactions.js";
import { ExtendedTransactionData, SandwichLoss, TransactionCoin, TransactionCoinRecord } from "../../../Interfaces.js";
import { findCoinSymbolById } from "../../readFunctions/Coins.js";
import { calculateLossForDeposit, calculateLossForSwap, calculateLossForWithdraw } from "./VictimLossFromSandwich.js";
import { getTokenTransferEvents, getTxFromTxId } from "../../../web3Calls/generic.js";
import { getAbiBy } from "../../Abi.js";
import { LossTransaction, Sandwiches } from "../../../../models/Sandwiches.js";
import { readSandwichesInBatches, readSandwichesInBatchesForBlock } from "../../readFunctions/Sandwiches.js";

export async function enrichCandidateWithCoinInfo(candidate: TransactionData[]): Promise<ExtendedTransactionData[] | null> {
  // Extract tx_ids from candidate array
  const txIds = candidate.map((transaction) => transaction.tx_id);

  // Fetch corresponding TransactionCoins records
  const transactionCoinsRecords = await TransactionCoins.findAll({
    where: { tx_id: { [Op.in]: txIds } },
  });

  // Fetch coin symbols
  const coinSymbols = await Promise.all(transactionCoinsRecords.map((record) => findCoinSymbolById(record.coin_id)));

  // Add coin symbols to transactionCoins records
  const transactionCoinsRecordsWithSymbols: TransactionCoinRecord[] = transactionCoinsRecords.map((record, index) => ({
    tx_id: record.tx_id,
    coin_id: record.coin_id,
    amount: record.amount,
    dollar_value: record.dollar_value,
    direction: record.direction,
    coin_symbol: coinSymbols[index],
  }));

  // Map updated TransactionCoins records by tx_id for easier lookup
  const transactionCoinsByTxIdWithSymbols: Record<number, TransactionCoinRecord[]> = transactionCoinsRecordsWithSymbols.reduce(
    (acc: Record<number, TransactionCoinRecord[]>, record: TransactionCoinRecord) => {
      if (acc[record.tx_id]) {
        acc[record.tx_id].push(record);
      } else {
        acc[record.tx_id] = [record];
      }
      return acc;
    },
    {}
  );

  // Add TransactionCoins data to candidate transactions
  const enrichedCandidate = candidate.map((transaction) => {
    const transactionCoins: TransactionCoin[] =
      transactionCoinsByTxIdWithSymbols[transaction.tx_id ?? 0]?.map((coin) => ({
        ...coin,
        amount: String(coin.amount),
        dollar_value: coin.dollar_value !== null ? String(coin.dollar_value) : null,
      })) || [];

    return {
      ...transaction,
      transactionCoins,
    };
  });

  return enrichedCandidate;
}

export async function calcTheLossOfCurveUserFromSandwich(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  if (parsedTx.transaction_type === "swap") return await calculateLossForSwap(parsedTx);
  if (parsedTx.transaction_type === "deposit") return await calculateLossForDeposit(parsedTx);
  if (parsedTx.transaction_type === "remove") return await calculateLossForWithdraw(parsedTx);
  return null;
}

export async function findMatchingTokenTransferAmout(coinID: number, parsedTx: any, amountHappyUser: number) {
  const COIN_TRANSFER_EVENTS = await getTokenTransferEvents(coinID!, parsedTx.block_number);
  if (!Array.isArray(COIN_TRANSFER_EVENTS)) return null;
  let amounts: number[] = COIN_TRANSFER_EVENTS.map((EVENT) => (EVENT as any).returnValues.value / 1e18);
  let closest = amounts.reduce((prev, curr) => {
    return Math.abs(curr - amountHappyUser) < Math.abs(prev - amountHappyUser) ? curr : prev;
  });

  return closest;
}

export async function requiresDepositParam(pool_id: number): Promise<boolean> {
  const abi = await getAbiBy("AbisPools", { id: pool_id });
  const calcTokenAmountFunction = abi!.find((method) => method.name === "calc_token_amount");

  if (!calcTokenAmountFunction) {
    throw new Error("calc_token_amount function not found in ABI");
  }

  // Check if the function requires 2 parameters
  const requiresSecondParam = calcTokenAmountFunction.inputs.length === 2;

  return requiresSecondParam;
}

export async function saveSandwich(poolId: number, frontrunId: number, backrunId: number, extractedFromCurve: boolean, lossTransactions?: LossTransaction[] | null) {
  let lossInUsd = null;
  if (lossTransactions && lossTransactions.length > 0) {
    lossInUsd = lossTransactions.reduce((total, transaction) => total + (transaction.lossInUsd || 0), 0);
  }
  await Sandwiches.findOrCreate({
    where: { frontrun: frontrunId, backrun: backrunId },
    defaults: {
      pool_id: poolId,
      frontrun: frontrunId,
      backrun: backrunId,
      extracted_from_curve: extractedFromCurve,
      loss_transactions: lossTransactions,
    },
  });
}

export async function removeProcessedTransactions(transactions: TransactionData[]): Promise<TransactionData[]> {
  // Fetch all tx_ids in the sandwiches table
  const sandwiches = await Sandwiches.findAll({ attributes: ["frontrun", "backrun"] });
  const processedTxIds = sandwiches.reduce((result, sandwich) => {
    result.add(sandwich.frontrun);
    result.add(sandwich.backrun);
    return result;
  }, new Set<number>());

  // Filter out transactions that already appear in the sandwiches table
  return transactions.filter((transaction) => !processedTxIds.has(transaction.tx_id!));
}

function isValidEthereumAddress(someString: string): boolean {
  // Ethereum addresses are 42 characters long (including the '0x') and consist only of hexadecimal characters
  const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethereumAddressRegex.test(someString);
}

export async function addAddressesForLabeling(): Promise<void> {
  try {
    const batches = await readSandwichesInBatches();
    await solveBatches(batches);
  } catch (error) {
    console.error(`Error reading sandwiches in batches: ${error}`);
  }
}

export async function addAddressesForLabelingForBlock(blockNumber: number): Promise<void> {
  try {
    const batches = await readSandwichesInBatchesForBlock(blockNumber);
    await solveBatches(batches);
  } catch (error) {
    console.error(`Error reading sandwiches in batches: ${error}`);
  }
}

async function solveBatches(batches: { id: number; loss_transactions: any }[][]) {
  if (!batches) return;
  for (const batch of batches) {
    for (const lossTx of batch) {
      const tx = await getTxFromTxId(lossTx.loss_transactions[0].tx_id);
      if (!tx) {
        console.log(`Could not retrieve transaction for tx_id: ${lossTx.loss_transactions[0].tx_id}`);
        continue;
      }

      if (typeof tx.to !== "string" || !isValidEthereumAddress(tx.to)) {
        console.log(`Invalid Ethereum address for tx_id: ${lossTx.loss_transactions[0].tx_id}`);
        continue;
      }

      await Sandwiches.update({ source_of_loss_contract_address: tx.to }, { where: { id: lossTx.id } });
    }
  }
}
