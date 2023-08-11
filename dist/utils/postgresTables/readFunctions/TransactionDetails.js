import { TransactionDetails } from "../../../models/TransactionDetails.js";
import { getTxIdByTxHash } from "./Transactions.js";
export async function getFromAddress(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    if (transactionDetails) {
        return transactionDetails.from;
    }
    return null;
}
export async function getToAddress(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    if (transactionDetails) {
        return transactionDetails.to;
    }
    return null;
}
export async function getTransactionDetails(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    return transactionDetails || null;
}
export async function getTransactionDetailsByTxHash(txHash) {
    const txId = await getTxIdByTxHash(txHash);
    if (!txId) {
        console.log(`no txId for txHash ${txHash}`);
        return null;
    }
    const transactionDetails = await TransactionDetails.findByPk(txId);
    return transactionDetails || null;
}
export function extractTransactionAddresses(transactionDetails) {
    if (transactionDetails) {
        return { from: transactionDetails.from, to: transactionDetails.to };
    }
    return { from: null, to: null };
}
export function extractGasPrice(transactionDetails) {
    if (transactionDetails) {
        return transactionDetails.gasPrice;
    }
    return null;
}
//# sourceMappingURL=TransactionDetails.js.map