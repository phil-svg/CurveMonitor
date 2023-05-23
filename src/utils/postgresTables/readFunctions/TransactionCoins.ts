import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Coins } from "../../../models/Coins.js";
import { Op } from "sequelize";
import { CoinMovement } from "../../Interfaces.js";

export async function findTransactionCoinsByTxIds(tx_ids: number[]): Promise<CoinMovement[]> {
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
    const { createdAt, updatedAt, coin, ...rest } = transactionCoin.toJSON();

    const { createdAt: coinCreatedAt, updatedAt: coinUpdatedAt, ...coinRest } = coin;

    rest.amount = rest.amount.toString();

    return {
      ...rest,
      coin: coinRest,
    };
  });
}
