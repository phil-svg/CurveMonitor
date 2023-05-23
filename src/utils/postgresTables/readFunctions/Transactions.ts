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
