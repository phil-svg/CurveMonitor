import { QueryTypes } from 'sequelize';
import { logProgress } from '../../../helperFunctions/QualityOfLifeStuff.js';
import { getUnstoredCexDexArbTxIds, getUnstoredCexDexArbTxIdsForSinglePool, saveCexDexArb } from '../../CexDexArbs.js';
import { storeCexDexArbFlag } from '../../IsCexDexArb.js';
import { getAllPoolIds } from '../../readFunctions/Pools.js';
import { getToAddress } from '../../readFunctions/TransactionDetails.js';
import { getPoolIdByTxId } from '../../readFunctions/Transactions.js';
import { isCexDexArb } from './utils/cexdexDetection.js';
import { sequelize } from '../../../../config/Database.js';
async function getUnprocessedTxIds() {
    // SQL query that selects transaction IDs from the token_transfers table
    // that are not present in the is_cex_dex_arb table
    const query = `
    SELECT tt.tx_id
    FROM token_transfers tt
    LEFT JOIN is_cex_dex_arb icda ON tt.tx_id = icda.tx_id
    WHERE icda.tx_id IS NULL
    ORDER BY tt.tx_id ASC;
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
        console.error('Error retrieving unprocessed transaction IDs:', error);
        return [];
    }
}
async function processSingleTxId(txId, poolId) {
    const botAddress = await getToAddress(txId);
    await saveCexDexArb(txId, botAddress, poolId);
}
export async function processSinglCexDexTxId(txId) {
    const botAddress = await getToAddress(txId);
    const poolId = await getPoolIdByTxId(txId);
    if (!poolId)
        return;
    await saveCexDexArb(txId, botAddress, poolId);
}
async function processSinglePool(poolId) {
    const unstoredCexDexArbTxIds = await getUnstoredCexDexArbTxIdsForSinglePool(poolId);
    for (const txId of unstoredCexDexArbTxIds) {
        await processSingleTxId(txId, poolId);
    }
}
export async function updateCexDexArbTableOld() {
    const allPoolIds = await getAllPoolIds();
    const sortedPoolIds = allPoolIds.sort((a, b) => a - b);
    let counter = 0;
    let totalTimeTaken = 0;
    const totalToBeProcessed = sortedPoolIds.length;
    for (const poolId of sortedPoolIds) {
        const start = new Date().getTime();
        await processSinglePool(poolId);
        const end = new Date().getTime();
        totalTimeTaken += end - start;
        counter++;
        logProgress('updating CexDexArb-Table', 100, counter, totalTimeTaken, totalToBeProcessed);
    }
}
export async function updateCexDexArbTable() {
    let counter = 0;
    let totalTimeTaken = 0;
    const unstoredCexDexArbTxIds = await getUnstoredCexDexArbTxIds();
    for (const txId of unstoredCexDexArbTxIds) {
        const start = new Date().getTime();
        const poolId = await getPoolIdByTxId(txId);
        await processSingleTxId(txId, poolId);
        const end = new Date().getTime();
        totalTimeTaken += end - start;
        counter++;
        logProgress('updating CexDexArb-Table', 100, counter, totalTimeTaken, unstoredCexDexArbTxIds.length);
    }
}
export async function solveAndStoreCexDexArbFlag() {
    let counter = 0;
    let totalTimeTaken = 0;
    const unprocessedTxIds = await getUnprocessedTxIds();
    for (const txId of unprocessedTxIds) {
        const start = new Date().getTime();
        counter++;
        const arbStatus = await isCexDexArb(txId);
        if (arbStatus === 'unable to fetch') {
            // If unable to fetch, log the progress and continue to the next iteration
            const end = new Date().getTime();
            totalTimeTaken += end - start;
            logProgress('solving and storing CexDexArbFlags', 200, counter, totalTimeTaken, unprocessedTxIds.length);
            continue;
        }
        await storeCexDexArbFlag(txId, arbStatus);
        const end = new Date().getTime();
        totalTimeTaken += end - start;
        logProgress('solving and storing CexDexArbFlags', 200, counter, totalTimeTaken, unprocessedTxIds.length);
    }
    console.log(`[✓] CexDexArbFlags synced successfully.`);
}
export async function updateCexDexArbDetection() {
    await solveAndStoreCexDexArbFlag();
    await updateCexDexArbTable();
    console.log(`[✓] CexDexArbs synced successfully.`);
}
//# sourceMappingURL=CexDexArb.js.map