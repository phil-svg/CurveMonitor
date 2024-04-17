import Sequelize from 'sequelize';
import { TransactionTrace } from '../../models/TransactionTrace.js';
import { logProgress, updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { getTransactionTraceViaWeb3Provider } from '../web3Calls/generic.js';
import { sequelize } from '../../config/Database.js';
export async function saveTransactionTrace(txHash, transactionTrace) {
    if (transactionTrace) {
        for (const trace of transactionTrace) {
            if (trace.result) {
                await TransactionTrace.create({
                    transactionHash: txHash,
                    traceAddress: trace.traceAddress,
                    type: trace.type,
                    subtraces: trace.subtraces,
                    blockNumber: trace.blockNumber,
                    blockHash: trace.blockHash,
                    actionCallType: trace.action.callType,
                    actionFrom: trace.action.from,
                    actionTo: trace.action.to,
                    actionGas: trace.action.gas,
                    actionInput: trace.action.input,
                    actionValue: trace.action.value,
                    resultGasUsed: trace.result.gasUsed,
                    resultOutput: trace.result.output,
                });
            }
        }
    }
    else {
        console.log(`failed to fetch trace for tx ${txHash}`);
    }
}
export async function getTxTracesToBeFetchedSet() {
    const query = `
    SELECT DISTINCT t.tx_hash
    FROM transactions t
    LEFT JOIN transaction_trace tt ON t.tx_hash = tt."transactionHash"
    WHERE tt."transactionHash" IS NULL
  `;
    const result = await sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
        raw: true,
    });
    const toBeFetchedSet = result.map((item) => item.tx_hash);
    return toBeFetchedSet;
}
export async function updateTxTraces() {
    try {
        // Find the set of transaction hashes for which we need to fetch transaction traces.
        const toBeFetchedSet = await getTxTracesToBeFetchedSet();
        const totalToBeFetched = toBeFetchedSet.length;
        let fetchCount = 0;
        let totalTimeTaken = 0;
        for (const txHash of toBeFetchedSet) {
            const start = new Date().getTime();
            const transactionTrace = await getTransactionTraceViaWeb3Provider(txHash);
            const end = new Date().getTime();
            totalTimeTaken += end - start;
            fetchCount++;
            await saveTransactionTrace(txHash, transactionTrace);
            logProgress('updateTxTraces', 50, fetchCount, totalTimeTaken, totalToBeFetched);
        }
    }
    catch (error) {
        console.error(error);
    }
    updateConsoleOutput('[✓] transaction_traces storing completed.\n');
}
//# sourceMappingURL=TransactionTraces.js.map