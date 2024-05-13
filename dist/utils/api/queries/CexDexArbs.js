import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { getTimeframeTimestamp } from '../utils/Timeframes.js';
import { enrichTransactionDetail } from '../../postgresTables/readFunctions/TxDetailEnrichment.js';
import { getEnrichedCexDexDetails } from '../../postgresTables/mevDetection/cexdex/utils/cexdexDetection.js';
import { CexDexArbs } from '../../../models/CexDexArbs.js';
import { Transactions } from '../../../models/Transactions.js';
import { getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';
export async function getTotalNumberOfCexDexArbsForDuration(timeDuration) {
    const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    const query = `
    SELECT COUNT(*) AS total
    FROM cex_dex_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
  `;
    const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        raw: false,
        replacements: {
            timeframeStartUnix,
        },
    });
    const totalCount = result[0].total;
    return totalCount;
}
export async function getNumberOfCexDexArbsForPoolAndDuration(poolAddress, timeDuration) {
    const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    const query = `
    SELECT COUNT(*) AS total
    FROM cex_dex_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.pool_id = :poolId
  `;
    const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        raw: false,
        replacements: {
            timeframeStartUnix,
            poolId,
        },
    });
    const totalCount = result[0].total;
    return totalCount;
}
export async function getCexDexArbDetailsFromTxId(txId) {
    const enrichedTransaction = await enrichTransactionDetail(txId);
    if (!enrichedTransaction)
        return null;
    const enrichedCexDexDetails = await getEnrichedCexDexDetails(enrichedTransaction);
    return enrichedCexDexDetails;
}
export async function getCexDexArbsForDuration(duration, page) {
    const recordsPerPage = 10;
    const offset = (page - 1) * recordsPerPage;
    const timeframeStartUnix = getTimeframeTimestamp(duration);
    const cexDexArbs = await CexDexArbs.findAll({
        attributes: ['tx_id'],
        include: [
            {
                model: Transactions,
                as: 'transaction',
                attributes: [],
                where: {
                    block_unixtime: {
                        [Op.gte]: timeframeStartUnix,
                    },
                },
                required: true,
            },
        ],
        limit: recordsPerPage,
        offset: offset,
        order: [['transaction', 'block_unixtime', 'DESC']],
    });
    const txIds = cexDexArbs.map((arb) => arb.tx_id);
    const enrichedCexDexArbs = await Promise.all(txIds.map(async (txId) => await getCexDexArbDetailsFromTxId(txId)));
    return enrichedCexDexArbs.filter((arb) => arb !== null);
}
export async function getCexDexArbsForPoolAndDuration(poolAddress, duration, page) {
    const recordsPerPage = 10;
    const offset = (page - 1) * recordsPerPage;
    const timeframeStartUnix = getTimeframeTimestamp(duration);
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    const cexDexArbs = await CexDexArbs.findAll({
        attributes: ['tx_id'],
        include: [
            {
                model: Transactions,
                as: 'transaction',
                attributes: [],
                where: {
                    block_unixtime: {
                        [Op.gte]: timeframeStartUnix,
                    },
                    pool_id: poolId,
                },
                required: true,
            },
        ],
        limit: recordsPerPage,
        offset: offset,
        order: [['transaction', 'block_unixtime', 'DESC']],
    });
    const txIds = cexDexArbs.map((arb) => arb.tx_id);
    const enrichedCexDexArbs = await Promise.all(txIds.map(async (txId) => await getCexDexArbDetailsFromTxId(txId)));
    return enrichedCexDexArbs.filter((arb) => arb !== null);
}
export async function getFullCexDexArbTable(duration, page) {
    const totalNumberOfCexDexArbs = await getTotalNumberOfCexDexArbsForDuration(duration);
    const atomicArbs = await getCexDexArbsForDuration(duration, page);
    return { data: atomicArbs, totalNumberOfCexDexArbs };
}
export async function getPoolSpecificCexDexArbTable(poolAddress, duration, page) {
    const totalNumberOfCexDexArbs = await getNumberOfCexDexArbsForPoolAndDuration(poolAddress, duration);
    const cexDexArbs = await getCexDexArbsForPoolAndDuration(poolAddress, duration, page);
    return { data: cexDexArbs, totalNumberOfCexDexArbs };
}
export async function getCexDexArbBotLeaderBoardbyTxCountForPoolAndDuration(poolAddress, duration) {
    const timeframeStartUnix = getTimeframeTimestamp(duration);
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    if (!poolId) {
        throw new Error(`Pool ID not found for address: ${poolAddress}`);
    }
    const query = `
    SELECT 
      cda.bot_address AS contractAddress, 
      COUNT(*) AS txCount
    FROM 
      cex_dex_arbs cda
    JOIN 
      transactions t ON cda.tx_id = t.tx_id
    WHERE 
      t.block_unixtime >= :timeframeStartUnix
      AND t.pool_id = :poolId
      AND cda.bot_address IS NOT NULL
    GROUP BY 
      cda.bot_address
    ORDER BY 
      txCount DESC
  `;
    const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        raw: true,
        replacements: {
            timeframeStartUnix,
            poolId,
        },
    });
    return result;
}
//# sourceMappingURL=CexDexArbs.js.map