import { TransactionDetails } from "../../../models/TransactionDetails.js";
import { getTxIdByTxHash } from "./Transactions.js";

export async function getFromAddress(txId: number): Promise<string | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  if (transactionDetails) {
    return transactionDetails.from;
  }
  return null;
}

export async function getToAddress(txId: number): Promise<string | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  if (transactionDetails) {
    return transactionDetails.to;
  }
  return null;
}

export async function getTransactionDetails(txId: number): Promise<TransactionDetails | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  return transactionDetails || null;
}

export async function getTransactionDetailsByTxHash(txHash: string): Promise<TransactionDetails | null> {
  const txId = await getTxIdByTxHash(txHash);
  if (!txId) {
    console.log(`no txId for txHash ${txHash}`);
    return null;
  }

  const transactionDetails = await TransactionDetails.findByPk(txId);
  return transactionDetails || null;
}

export function extractTransactionAddresses(transactionDetails: TransactionDetails | null): { from: string | null; to: string | null } {
  if (transactionDetails) {
    return { from: transactionDetails.from, to: transactionDetails.to };
  }
  return { from: null, to: null };
}

export function extractGasPrice(transactionDetails: TransactionDetails | null): string | null {
  if (transactionDetails) {
    return transactionDetails.gasPrice;
  }
  return null;
}

export async function getBlockNumberByTxHash(hash: string): Promise<number | null> {
  const transactionDetail = await TransactionDetails.findOne({ where: { hash: hash } });

  if (transactionDetail) {
    return transactionDetail.blockNumber;
  }

  return null;
}
