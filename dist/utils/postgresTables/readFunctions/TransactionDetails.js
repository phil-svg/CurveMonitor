import { TransactionDetails } from "../../../models/TransactionDetails.js";
export async function getFromAddress(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    if (transactionDetails) {
        return transactionDetails.from;
    }
    return null;
}
//# sourceMappingURL=TransactionDetails.js.map