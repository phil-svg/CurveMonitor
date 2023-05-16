import { Transactions, TransactionData } from "../../../models/Transactions.js";

export async function saveTransaction(transactionData: TransactionData): Promise<Transactions> {
  try {
    const transaction = await Transactions.create(transactionData);
    return transaction;
  } catch (error) {
    console.error("Error saving transaction:", error);
    throw error;
  }
}
