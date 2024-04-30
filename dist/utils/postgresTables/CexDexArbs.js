import { Op, QueryTypes } from 'sequelize';
import { CexDexArbs } from '../../models/CexDexArbs.js';
import { IsCexDexArb } from '../../models/IsCexDexArb.js';
import { Transactions } from '../../models/Transactions.js';
import { sequelize } from '../../config/Database.js';
// returns an array of tx_ids for a given pool, which are cexdexarbs, and not saved in CexDexArb-Table.
export async function getUnstoredCexDexArbTxIdsForSinglePool(poolId) {
    try {
        const allArbTxIds = await IsCexDexArb.findAll({
            attributes: ['tx_id'],
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
            attributes: ['tx_id'],
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
    }
    catch (error) {
        console.error('Error retrieving unstored CexDexArb transaction IDs:', error);
        return [];
    }
}
export async function getUnstoredCexDexArbTxIds() {
    // SQL query that selects transaction IDs from the is_cex_dex_arb table
    // where is_cex_dex_arb is true and not present in the cex_dex_arbs table
    const query = `
    SELECT ida.tx_id
    FROM is_cex_dex_arb ida
    WHERE ida.is_cex_dex_arb = true
      AND NOT EXISTS (
        SELECT 1 FROM cex_dex_arbs cda
        WHERE cda.tx_id = ida.tx_id
      )
    ORDER BY ida.tx_id ASC;
  `;
    try {
        // Execute the query using sequelize
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
        });
        // Map the result to return an array of transaction IDs (numbers)
        return result.map((item) => item.tx_id);
    }
    catch (error) {
        console.error('Error retrieving unstored CexDexArb transaction IDs:', error);
        return [];
    }
}
export async function saveCexDexArb(txId, botAddress, poolId) {
    try {
        await CexDexArbs.upsert({
            tx_id: txId,
            bot_address: botAddress,
            pool_id: poolId,
        });
    }
    catch (error) {
        console.error(`Failed to save arbitrage record for transaction ID ${txId}:`, error);
    }
}
//# sourceMappingURL=CexDexArbs.js.map