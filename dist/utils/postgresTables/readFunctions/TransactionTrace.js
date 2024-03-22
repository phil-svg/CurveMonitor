import { TransactionTrace } from "../../../models/TransactionTrace.js";
export async function getTransactionTraceFromDb(txHash) {
    const dbTraces = await TransactionTrace.findAll({ where: { transactionHash: txHash } });
    // Function to compare trace addresses
    function compareTraceAddress(a, b) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] !== b[i]) {
                return a[i] - b[i];
            }
        }
        return a.length - b.length; // Shorter array comes first if all previous elements are equal
    }
    // Sort the traces based on traceAddress
    dbTraces.sort((a, b) => compareTraceAddress(a.traceAddress, b.traceAddress));
    // Filter out duplicates based on subtrace and traceAddress
    const uniqueTraces = dbTraces.filter((trace, index, self) => index === self.findIndex((t) => t.subtraces === trace.subtraces && compareTraceAddress(t.traceAddress, trace.traceAddress) === 0));
    // Map the unique traces to the ITransactionTrace shape
    return uniqueTraces.map((dbTrace) => ({
        action: {
            callType: dbTrace.actionCallType,
            from: dbTrace.actionFrom,
            gas: dbTrace.actionGas,
            input: dbTrace.actionInput,
            to: dbTrace.actionTo,
            value: dbTrace.actionValue,
        },
        blockHash: dbTrace.blockHash,
        blockNumber: dbTrace.blockNumber,
        result: {
            gasUsed: dbTrace.resultGasUsed,
            output: dbTrace.resultOutput,
        },
        subtraces: dbTrace.subtraces,
        traceAddress: dbTrace.traceAddress,
        transactionHash: dbTrace.transactionHash,
        type: dbTrace.type,
    }));
}
//# sourceMappingURL=TransactionTrace.js.map