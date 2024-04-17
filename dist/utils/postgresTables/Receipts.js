import { Receipts } from '../../models/Receipts.js';
import { WEB3_HTTP_PROVIDER, getTxReceiptClassic } from '../web3Calls/generic.js';
import { logProgress, updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { sequelize } from '../../config/Database.js';
import { QueryTypes } from 'sequelize';
function convertHexReceiptToDecimal(hexTxReceipt) {
    return {
        transactionHash: hexTxReceipt.transactionHash,
        blockHash: hexTxReceipt.blockHash,
        blockNumber: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.blockNumber),
        logs: hexTxReceipt.logs.map((log) => {
            return {
                transactionHash: log.transactionHash,
                address: log.address,
                blockHash: log.blockHash,
                blockNumber: WEB3_HTTP_PROVIDER.utils.toDecimal(log.blockNumber),
                data: log.data,
                logIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(log.logIndex),
                removed: log.removed,
                topics: log.topics,
                transactionIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(log.transactionIndex),
            };
        }),
        contractAddress: hexTxReceipt.contractAddress,
        effectiveGasPrice: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.effectiveGasPrice),
        cumulativeGasUsed: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.cumulativeGasUsed),
        from: hexTxReceipt.from,
        gasUsed: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.gasUsed),
        logsBloom: hexTxReceipt.logsBloom,
        status: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.status),
        to: hexTxReceipt.to,
        transactionIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.transactionIndex),
        type: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.type),
    };
}
export async function fetchAndSaveReceipt(txHash, txId) {
    // let hexTxReceipt: HexTxReceipt = await getTxReceipt(txHash);
    // if (!hexTxReceipt) {
    //   console.warn(`No receipt found for hash: ${txHash} in fetchAndSaveReceipt`);
    //   return null;
    // }
    //
    // type: txReceipt.type,
    // const txReceipt: TxReceipt = convertHexReceiptToDecimal(hexTxReceipt);
    let txReceipt = await getTxReceiptClassic(txHash);
    if (txReceipt) {
        // Iterate over each log in txReceipt.logs.
        for (const log of txReceipt.logs) {
            // Create a new database record for each log.
            await Receipts.create(Object.assign(Object.assign({}, log), { tx_id: txId, transactionHash: txReceipt.transactionHash, blockHash: txReceipt.blockHash, blockNumber: txReceipt.blockNumber, contractAddress: txReceipt.contractAddress, effectiveGasPrice: txReceipt.effectiveGasPrice, cumulativeGasUsed: txReceipt.cumulativeGasUsed, from: txReceipt.from, gasUsed: txReceipt.gasUsed, logsBloom: txReceipt.logsBloom, status: txReceipt.status, to: txReceipt.to, type: 2 }));
        }
        return true;
    }
    else {
        console.log(`No receipt found for hash: ${txHash} in fetchAndSaveReceipt`);
    }
}
async function getTxHashesToFetch() {
    const toBeFetchedSet = await sequelize.query(`
    SELECT t.tx_hash AS "txHash", t.tx_id AS "txId"
    FROM transactions t
    LEFT JOIN receipts r ON t.tx_hash = r."transactionHash"
    WHERE r."transactionHash" IS NULL
  `, {
        type: QueryTypes.SELECT,
        raw: true,
    });
    return toBeFetchedSet;
}
export async function updateReceipts() {
    try {
        const toBeFetchedSet = await getTxHashesToFetch();
        const totalToBeFetched = toBeFetchedSet.length;
        let count = 0;
        let totalTimeTaken = 0;
        // For each transaction hash in toBeFetchedSet.
        for (const entry of toBeFetchedSet) {
            const txHash = entry.txHash;
            const txId = entry.txId;
            if (txHash === '0x1cb373281a6aa3c161eb073b5f49f38f5c2a2a6e8ed9dcb637c941ede601daff')
                continue;
            if (txHash === '0xd67ec9e7a7c5bc4b2b7ee12ffb3a1a3c182d5d83a03df1d750663340d11af4fd')
                continue;
            if (!txId) {
                console.log('no txId found for txHash', txHash, 'in updateReceipts');
                process.exit();
            }
            try {
                const start = new Date().getTime();
                await fetchAndSaveReceipt(txHash, txId);
                count++;
                const end = new Date().getTime();
                totalTimeTaken += end - start;
                logProgress('Fetching Receipts', 100, count, totalTimeTaken, totalToBeFetched);
            }
            catch (err) {
                console.warn(`Failed to fetch and save receipt for hash: ${txHash}`);
                console.error(err);
            }
        }
    }
    catch (error) {
        console.error(error);
    }
    updateConsoleOutput('[✓] Receipts stored successfully.\n');
}
//# sourceMappingURL=Receipts.js.map