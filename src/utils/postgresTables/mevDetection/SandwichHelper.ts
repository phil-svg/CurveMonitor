import { Op } from "sequelize";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { TransactionData } from "../../../models/Transactions.js";
import { TransactionCoinRecord } from "../../Interfaces.js";
import { findCoinSymbolById } from "../readFunctions/Coins.js";

export async function enrichCandidateWithCoinInfo(
  candidate: TransactionData[]
): Promise<(TransactionData & { transactionCoins: Pick<TransactionCoins, "coin_id" | "amount" | "dollar_value" | "direction">[] })[] | null> {
  // Extract tx_ids from candidate array
  const txIds = candidate.map((transaction) => transaction.tx_id);

  // Fetch corresponding TransactionCoins records
  const transactionCoinsRecords = await TransactionCoins.findAll({
    where: { tx_id: { [Op.in]: txIds } },
  });

  // Map TransactionCoins records by tx_id for easier lookup
  const transactionCoinsByTxId: Record<number, TransactionCoins[]> = transactionCoinsRecords.reduce((acc: Record<number, TransactionCoins[]>, record: TransactionCoins) => {
    if (acc[record.tx_id]) {
      acc[record.tx_id].push(record);
    } else {
      acc[record.tx_id] = [record];
    }
    return acc;
  }, {});

  // Add TransactionCoins data to candidate transactions
  const enrichedCandidate = candidate.map((transaction) => ({
    ...transaction,
    transactionCoins: transactionCoinsByTxId[transaction.tx_id ?? 0] || [],
  }));

  return enrichedCandidate;
}

export async function enrichCandidateWithSymbol(candidate: TransactionData[]): Promise<(TransactionData & { transactionCoins: TransactionCoinRecord[] })[]> {
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
  const enrichedCandidate = candidate.map((transaction) => ({
    ...transaction,
    transactionCoins: transactionCoinsByTxIdWithSymbols[transaction.tx_id ?? 0] || [],
  }));

  return enrichedCandidate;
}
