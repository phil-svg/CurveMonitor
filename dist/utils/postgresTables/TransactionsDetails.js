import _ from 'lodash';
import { getTxFromTxHash } from '../web3Calls/generic.js';
import { getAllTransactionIds, getTxHashByTxId } from './readFunctions/Transactions.js';
import { TransactionDetails } from '../../models/TransactionDetails.js';
import { logProgress, updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { getAllTxIdsPresentInTransactionsDetails } from './readFunctions/TransactionDetails.js';
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
    const txIdsInTransactionsDetails = await getAllTxIdsPresentInTransactionsDetails();
    const allTxIds = await getAllTransactionIds();
    return _.difference(allTxIds, txIdsInTransactionsDetails);
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
            logProgress('updating TransactionsDetails', 40, counter, totalTimeTaken, totalToBeProcessed);
        }
        catch (error) {
            console.error(`Error in chunk ${i + 1} of updateTransactionsDetails: ${error}`);
        }
    }
    updateConsoleOutput('[✓] TransactionsDetails parsed successfully.\n');
}
//# sourceMappingURL=TransactionsDetails.js.map