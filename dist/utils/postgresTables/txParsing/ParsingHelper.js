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
//# sourceMappingURL=ParsingHelper.js.map