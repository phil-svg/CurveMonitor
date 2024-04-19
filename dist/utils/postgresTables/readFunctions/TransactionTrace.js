import Sequelize from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { TransactionTrace } from '../../../models/TransactionTrace.js';
export async function getTransactionTraceFromDb(txHash) {
    const query = `
    SELECT 
      "transactionHash",
      "traceAddress",
      "type",
      "subtraces",
      "blockNumber",
      "blockHash",
      "actionCallType",
      "actionFrom",
      "actionTo",
      "actionGas",
      "actionInput",
      "actionValue",
      "resultGasUsed",
      "resultOutput"
    FROM transaction_trace
    WHERE "transactionHash" = :txHash
    ORDER BY "traceAddress"
  `;
    const dbTraces = await sequelize.query(query, {
        replacements: { txHash },
        type: Sequelize.QueryTypes.SELECT,
        raw: true,
        model: TransactionTrace,
        mapToModel: true,
    });
    // Filter out duplicates based on subtrace and traceAddress
    const uniqueTraces = dbTraces.filter((trace, index, self) => index ===
        self.findIndex((t) => t.subtraces === trace.subtraces && compareTraceAddress(t.traceAddress, trace.traceAddress) === 0));
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
// Function to compare trace addresses
function compareTraceAddress(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }
    return a.length - b.length; // Shorter array comes first if all previous elements are equal
}
//# sourceMappingURL=TransactionTrace.js.map