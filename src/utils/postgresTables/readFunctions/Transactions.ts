import { Sequelize } from "sequelize";
import { Transactions, TransactionData } from "../../../models/Transactions.js";

export async function findTransactionsByPoolIdAndHash(pool_id: number, tx_hash: string): Promise<TransactionData[]> {
  const transactions = await Transactions.findAll({
    where: {
      pool_id,
      tx_hash,
    },
  });

  return transactions.map((transaction) => transaction.dataValues);
}

export async function getActivePools(): Promise<number[]> {
  const activeTransactions = await Transactions.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("pool_id")), "pool_id"]],
  });

  const activePoolIds = activeTransactions.map((transaction) => transaction.pool_id);

  return activePoolIds;
}

export async function getTransactionUnixtimes(txIds: number[]): Promise<{ tx_id: number; block_unixtime: number }[]> {
  // Find the transactions with the given ids
  const transactions = await Transactions.findAll({
    where: {
      tx_id: txIds,
    },
    attributes: ["tx_id", "block_unixtime"], // Select only 'tx_id' and 'block_unixtime'
  });

  // Map the transactions to the desired format
  const result = transactions.map((transaction) => ({
    tx_id: transaction.tx_id,
    block_unixtime: transaction.block_unixtime,
  }));

  return result;
}
