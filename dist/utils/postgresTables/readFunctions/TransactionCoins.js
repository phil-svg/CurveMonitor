var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Coins } from "../../../models/Coins.js";
import { Op } from "sequelize";
export async function findTransactionCoinsByTxIds(tx_ids) {
    const transactionCoins = await TransactionCoins.findAll({
        where: {
            tx_id: {
                [Op.in]: tx_ids,
            },
            amount: {
                [Op.ne]: 0,
            },
        },
        include: [
            {
                model: Coins,
                as: "coin",
            },
        ],
    });
    return transactionCoins.map((transactionCoin) => {
        const _a = transactionCoin.toJSON(), { createdAt, updatedAt, coin } = _a, rest = __rest(_a, ["createdAt", "updatedAt", "coin"]);
        const { createdAt: coinCreatedAt, updatedAt: coinUpdatedAt } = coin, coinRest = __rest(coin, ["createdAt", "updatedAt"]);
        rest.amount = rest.amount.toString();
        return Object.assign(Object.assign({}, rest), { coin: coinRest });
    });
}
export async function getAllCoinIds() {
    const coinIds = await TransactionCoins.findAll({
        attributes: ["coin_id"],
        group: ["coin_id"],
    });
    return coinIds.map((transactionCoin) => transactionCoin.coin_id);
}
//# sourceMappingURL=TransactionCoins.js.map