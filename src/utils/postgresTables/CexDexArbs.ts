import { Op } from "sequelize";
import { CexDexArbs } from "../../models/CexDexArbs.js";
import { IsCexDexArb } from "../../models/IsCexDexArb.js";
import { Transactions } from "../../models/Transactions.js";

// returns an array of tx_ids for a given pool, which are cexdexarbs, and not saved in CexDexArb-Table.
export async function getUnstoredCexDexArbTxIdsForSinglePool(poolId: number): Promise<number[]> {
  try {
    const allArbTxIds = await IsCexDexArb.findAll({
      attributes: ["tx_id"],
      include: [
        {
          model: Transactions,
          attributes: [],
          where: { pool_id: poolId },
        },
      ],
      where: {
        is_cex_dex_arb: true,
      },
      raw: true,
    });

    const arbTxIds = allArbTxIds.map((record) => record.tx_id);

    const storedArbTxIds = await CexDexArbs.findAll({
      attributes: ["tx_id"],
      where: {
        tx_id: {
          [Op.in]: arbTxIds,
        },
      },
      raw: true,
    });

    const storedTxIdsSet = new Set(storedArbTxIds.map((record) => record.tx_id));

    const unstoredTxIds = arbTxIds.filter((txId) => !storedTxIdsSet.has(txId));

    return unstoredTxIds;
  } catch (error) {
    console.error("Error retrieving unstored CexDexArb transaction IDs:", error);
    return [];
  }
}

export async function getUnstoredCexDexArbTxIds(): Promise<number[]> {
  try {
    const allArbTxIds = await IsCexDexArb.findAll({
      attributes: ["tx_id"],
      include: [
        {
          model: Transactions,
          attributes: [],
        },
      ],
      where: {
        is_cex_dex_arb: true,
      },
      raw: true,
    });

    const arbTxIds = allArbTxIds.map((record) => record.tx_id);

    const storedArbTxIds = await CexDexArbs.findAll({
      attributes: ["tx_id"],
      where: {
        tx_id: {
          [Op.in]: arbTxIds,
        },
      },
      raw: true,
    });

    const storedTxIdsSet = new Set(storedArbTxIds.map((record) => record.tx_id));

    const unstoredTxIds = arbTxIds.filter((txId) => !storedTxIdsSet.has(txId));

    return unstoredTxIds;
  } catch (error) {
    console.error("Error retrieving unstored CexDexArb transaction IDs:", error);
    return [];
  }
}

export async function saveCexDexArb(txId: number, botAddress: string | null, poolId: number): Promise<void> {
  try {
    await CexDexArbs.upsert({
      tx_id: txId,
      bot_address: botAddress,
      pool_id: poolId,
    });
  } catch (error) {
    console.error(`Failed to save arbitrage record for transaction ID ${txId}:`, error);
  }
}
