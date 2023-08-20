import { TransactionTrace } from "../../../models/TransactionTrace.js";
export async function getTransactionTraceFromDb(txHash) {
    const dbTraces = await TransactionTrace.findAll({ where: { transactionHash: txHash } });
    // Map the returned Sequelize models to the ITransactionTrace shape
    return dbTraces.map((dbTrace) => ({
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