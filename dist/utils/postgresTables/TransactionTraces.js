import Sequelize from "sequelize";
import { Transactions } from "../../models/Transactions.js";
import { TransactionTrace } from "../../models/TransactionTrace.js";
import { logProgress, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { getTransactionTraceViaWeb3Provider } from "../web3Calls/generic.js";
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
export async function updateTxTraces() {
    try {
        const transactions = await Transactions.findAll({
            attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("tx_hash")), "tx_hash"]],
            raw: true,
        });
        // Fetch all unique transaction hashes from TransactionTraces.
        const existingTransactionTraces = await TransactionTrace.findAll({
            attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("transactionHash")), "transactionHash"]],
        });
        // Create sets of hashes for easier comparison.
        const transactionsSet = new Set(transactions.map((tx) => tx.tx_hash));
        const existingTransactionTracesSet = new Set(existingTransactionTraces.map((trace) => trace.transactionHash));
        // Find the set of transaction hashes for which we need to fetch transaction traces.
        const toBeFetchedSet = [...transactionsSet].filter((txHash) => !existingTransactionTracesSet.has(txHash));
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
            logProgress("updateTxTraces", 50, fetchCount, totalTimeTaken, totalToBeFetched);
        }
    }
    catch (error) {
        console.error(error);
    }
    updateConsoleOutput("[✓] transaction_traces storing completed.\n");
}
//# sourceMappingURL=TransactionTraces.js.map