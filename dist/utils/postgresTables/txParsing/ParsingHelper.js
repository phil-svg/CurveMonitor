import { Transactions } from "../../../models/Transactions.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
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
export async function saveCoins(coins) {
    try {
        for (const coin of coins) {
            const transactionCoinData = {
                tx_id: coin.tx_id,
                coin_id: coin.COIN_ID,
                amount: coin.coinAmount,
                direction: coin.direction,
            };
            await TransactionCoins.create(transactionCoinData);
        }
    }
    catch (error) {
        console.error("Error saving coin data:", error);
        throw error;
    }
}
export async function transactionExists(eventId) {
    const existingTransaction = await Transactions.findOne({ where: { event_id: eventId } });
    return !!existingTransaction;
}
//# sourceMappingURL=ParsingHelper.js.map