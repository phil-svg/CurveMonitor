import { Op } from "sequelize";
import _ from "lodash";
import { TransactionCalls } from "../../models/TransactionCalls.js";
import { Transactions } from "../../models/Transactions.js";
import { getTxWithLimiter } from "../web3Calls/generic.js";
import { getTxHashByTxId } from "./readFunctions/Transactions.js";
export async function solveSingleTdId(txId) {
    const txHash = await getTxHashByTxId(txId);
    if (!txHash)
        return null;
    const tx = await getTxWithLimiter(txHash);
    // Return 'called_address' field and tx_id to be saved later
    return { txId: txId, called_address: tx.to };
}
export async function updateTransactionsCalls() {
    try {
        // Fetch all tx_ids from the TransactionCalls table
        const existingCalls = await TransactionCalls.findAll({
            attributes: ["txId"],
            raw: true,
        });
        const existingTxIds = existingCalls.map((call) => call.txId);
        // Fetch tx_ids from the Transactions table which are not in TransactionCalls
        const unsolvedTransactions = await Transactions.findAll({
            where: {
                tx_id: { [Op.notIn]: existingTxIds },
            },
            attributes: ["tx_id"],
            raw: true,
        });
        // Divide unsolved transactions into chunks
        const chunkSize = 5; // Set this to whatever you deem appropriate
        const transactionChunks = _.chunk(unsolvedTransactions, chunkSize);
        // Process each chunk
        for (const [i, transactionChunk] of transactionChunks.entries()) {
            const results = await Promise.all(transactionChunk.map((transaction) => solveSingleTdId(transaction.tx_id)));
            // Filter out null results and save the 'to' field and tx_id
            const validResults = results.filter((result) => result !== null);
            await TransactionCalls.bulkCreate(validResults);
            console.log(`Completed ${i + 1} out of ${transactionChunks.length} chunks for TransactionCalls(${(((i + 1) / transactionChunks.length) * 100).toFixed(2)}%)`);
        }
    }
    catch (error) {
        console.error(`Error in updateTransactionsCalls: ${error}`);
    }
}
//# sourceMappingURL=TransactionsCalls.js.map