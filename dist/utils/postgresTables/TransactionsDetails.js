import { sequelize } from "../../config/Database.js";
import _ from "lodash";
import { getTxFromTxHash } from "../web3Calls/generic.js";
import { getTxHashByTxId } from "./readFunctions/Transactions.js";
import { TransactionDetails } from "../../models/TransactionDetails.js";
import { logProgress, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
export async function solveSingleTdId(txId) {
    const txHash = await getTxHashByTxId(txId);
    if (!txHash)
        return null;
    // const tx = await getTxWithLimiter(txHash);
    const tx = await getTxFromTxHash(txHash);
    if (!tx)
        return null;
    return {
        txId: txId,
        blockHash: tx.blockHash,
        blockNumber: tx.blockNumber,
        hash: tx.hash,
        chainId: tx.chainId,
        from: tx.from,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        input: tx.input,
        nonce: tx.nonce,
        r: tx.r,
        s: tx.s,
        to: tx.to,
        transactionIndex: tx.transactionIndex,
        type: tx.type,
        v: tx.v,
        value: tx.value,
    };
}
async function getUnsolvedTransactions() {
    const query = `
    SELECT 
      t."tx_id" 
    FROM 
      "transactions" AS t
      LEFT JOIN "transaction_details" AS td ON t."tx_id" = td."tx_id"
    WHERE 
      td."tx_id" IS NULL;
  `;
    const [results, metadata] = await sequelize.query(query, { type: "SELECT" });
    let unsolvedTransactions = [];
    if (results && typeof results === "object" && "tx_id" in results) {
        const txId = results.tx_id;
        unsolvedTransactions.push(txId);
    }
    return unsolvedTransactions;
}
export async function updateTransactionsDetails() {
    let unsolvedTxIds = await getUnsolvedTransactions();
    const chunkSize = 6;
    const transactionChunks = _.chunk(unsolvedTxIds, chunkSize);
    unsolvedTxIds = [];
    let totalTimeTaken = 0;
    for (const [i, transactionChunk] of transactionChunks.entries()) {
        try {
            const start = new Date().getTime();
            const results = await Promise.all(transactionChunk.map((txId) => solveSingleTdId(txId)));
            const validResults = results.filter((result) => result !== null);
            await TransactionDetails.bulkCreate(validResults);
            let counter = i + 1;
            let totalToBeProcessed = transactionChunks.length;
            const end = new Date().getTime();
            totalTimeTaken += end - start;
            logProgress("updating TransactionsDetails", 40, counter, totalTimeTaken, totalToBeProcessed);
        }
        catch (error) {
            console.error(`Error in chunk ${i + 1} of updateTransactionsDetails: ${error}`);
        }
    }
    updateConsoleOutput("[✓] TransactionsDetails parsed successfully.\n");
}
//# sourceMappingURL=TransactionsDetails.js.map