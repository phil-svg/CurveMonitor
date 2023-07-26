import { TransactionDetails } from "../../../models/TransactionDetails.js";

export async function getFromAddress(txId: number): Promise<string | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  if (transactionDetails) {
    return transactionDetails.from;
  }
  return null;
}
