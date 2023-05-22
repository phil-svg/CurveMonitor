import { Transactions } from "../../../models/Transactions.js";
export async function saveTransaction(transactionData) {
    try {
        const transaction = await Transactions.create(transactionData);
        return transaction;
    }
    catch (error) {
        console.error("Error saving transaction:", error);
        throw error;
    }
}
export async function transactionExists(eventId) {
    const existingTransaction = await Transactions.findOne({ where: { event_id: eventId } });
    return !!existingTransaction;
}
//# sourceMappingURL=ParsingHelper.js.map