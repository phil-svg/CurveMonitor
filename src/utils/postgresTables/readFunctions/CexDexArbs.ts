import { fn, col, Op } from "sequelize";
import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { Transactions } from "../../../models/Transactions.js";

export async function fetchCexDexArbTxIdsForPoolAndTime(poolId: number, startUnixtime: number, endUnixtime: number): Promise<number[]> {
  const arbTransactions = await CexDexArbs.findAll({
    where: {
      pool_id: poolId,
      "$transaction.block_unixtime$": {
        [Op.gte]: startUnixtime,
        [Op.lt]: endUnixtime,
      },
    },
    include: [
      {
        model: Transactions,
        required: true,
        attributes: [],
      },
    ],
    raw: true,
  });

  return arbTransactions.map((arb) => arb.tx_id);
}

export async function printCexDexBotAddressCounts(): Promise<void> {
  try {
    const botAddressCounts = await CexDexArbs.findAll({
      attributes: ["bot_address", [fn("COUNT", col("bot_address")), "count"]],
      where: {
        bot_address: {
          [Op.ne]: null,
        },
      },
      group: "bot_address",
      order: [[col("count"), "DESC"]],
    });

    console.log("Bot Address Counts:");
    botAddressCounts.forEach((entry: any) => {
      console.log(`${entry.bot_address}: ${entry.get("count")}`);
    });
  } catch (error) {
    console.error("Error while counting bot addresses:", error);
  }
}
