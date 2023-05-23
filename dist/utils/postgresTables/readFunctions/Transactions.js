import { Transactions } from "../../../models/Transactions.js";
export async function findTransactionsByPoolIdAndHash(pool_id, tx_hash) {
    const transactions = await Transactions.findAll({
        where: {
            pool_id,
            tx_hash,
        },
    });
    return transactions.map((transaction) => transaction.dataValues);
}
//# sourceMappingURL=Transactions.js.map