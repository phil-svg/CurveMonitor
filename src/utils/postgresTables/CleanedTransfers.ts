import { TokenTransfers } from '../../models/CleanedTransfers.js';
import { ReadableTokenTransfer } from '../Interfaces.js';
import { filterForCorrectTransfers, getCleanedTransfers } from './mevDetection/atomic/atomicArb.js';
import { getToAddressByTxId, getTxIdsWhereToIsNull } from './readFunctions/TransactionDetails.js';
import { getTxHashByTxId } from './readFunctions/Transactions.js';
import { logProgress } from '../helperFunctions/QualityOfLifeStuff.js';
import { getTransactionTraceViaWeb3Provider } from '../web3Calls/generic.js';
import { updateAbisFromTrace } from '../helperFunctions/Abi.js';
import {
  getTokenTransfersFromTransactionTrace,
  makeTransfersReadable,
  mergeAndFilterTransfers,
  removeDuplicatesAndUpdatePositions,
  updateTransferList,
} from '../txMap/TransferOverview.js';
import { parseEventsFromReceiptForEntireTxWithoutDbUsage } from '../txMap/Events.js';
import { sequelize } from '../../config/Database.js';
import { QueryTypes } from 'sequelize';
import { forOwn } from 'lodash';

export async function insertTokenTransfers(txId: number, transfers: ReadableTokenTransfer[]): Promise<void> {
  try {
    await TokenTransfers.upsert({
      tx_id: txId,
      cleaned_transfers: transfers,
    });
  } catch (error) {
    console.error('Error inserting token transfers:', error);
  }
}

export async function solveCleanTransfersForTx(txId: number, txHash: string): Promise<ReadableTokenTransfer[] | null> {
  const to = await getToAddressByTxId(txId);
  if (!to) return null;

  const cleanedTransfers = await getCleanedTransfers(txHash, to);
  if (!cleanedTransfers) return null;

  return cleanedTransfers;
}

async function getToDoTxIdsForCleanTransfers(): Promise<{ txId: number; txHash: string }[]> {
  const query = `
    SELECT t.tx_id, t.tx_hash
    FROM transactions t
    LEFT JOIN token_transfers tt ON t.tx_id = tt.tx_id
    WHERE tt.tx_id IS NULL
    ORDER BY t.tx_id ASC;
  `;

  const result = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
  });

  // Map the result to return an array of objects with txId and txHash
  return result.map((item: any) => ({
    txId: item.tx_id,
    txHash: item.tx_hash,
  }));
}

export async function updateCleanedTransfers() {
  const todoTransactions = await getToDoTxIdsForCleanTransfers();
  const txIdsWhereToIsNull = await getTxIdsWhereToIsNull();

  const txIdsSet = new Set(txIdsWhereToIsNull.map((tx) => tx.txId));
  const filteredTodoTx = todoTransactions.filter((transaction) => !txIdsSet.has(transaction.txId));

  let counter = 0;
  let totalTimeTaken = 0;
  const totalToBeProcessed = filteredTodoTx.length;
  let cleanedTransfersCache: { [txHash: string]: any } = {};

  for (const transaction of filteredTodoTx) {
    const txId = transaction.txId;
    const txHash = transaction.txHash;
    counter++;
    const start = new Date().getTime();

    let cleanedTransfers;
    // Check if the txHash already has cleanedTransfers in cache
    if (cleanedTransfersCache[txHash]) {
      cleanedTransfers = cleanedTransfersCache[txHash];
    } else {
      // Solve cleanedTransfers and cache it
      cleanedTransfers = await solveCleanTransfersForTx(txId, txHash);
      if (cleanedTransfers) {
        cleanedTransfersCache[txHash] = cleanedTransfers;
      }
    }

    if (!cleanedTransfers) continue;

    await insertTokenTransfers(txId, cleanedTransfers);

    const end = new Date().getTime();
    totalTimeTaken += end - start;

    // Clear the cache if txId is divisible by 5000
    if (counter % 100 === 0) {
      for (let key in cleanedTransfersCache) {
        if (cleanedTransfersCache.hasOwnProperty(key)) {
          delete cleanedTransfersCache[key];
        }
      }
    }
    logProgress('updateCleanedTransfers', 10, counter, totalTimeTaken, totalToBeProcessed);
  }

  console.log(`[✓] updateCleanedTransfers completed successfully.`);
}

export async function getCleanedTransfersFromTxHashWithoutDBUsage(
  txHash: string,
  to: string
): Promise<ReadableTokenTransfer[] | null> {
  let transactionTraces = await getTransactionTraceViaWeb3Provider(txHash);

  if (!transactionTraces) {
    console.log('alchemy trace api bugged out for', txHash);
    return null;
  }

  // making sure we have all ABIs which are relevant in this tx.
  await updateAbisFromTrace(transactionTraces);

  const tokenTransfersFromTransactionTraces = await getTokenTransfersFromTransactionTrace(transactionTraces);
  if (!tokenTransfersFromTransactionTraces) return null;
  // console.log('tokenTransfersFromTransactionTraces', tokenTransfersFromTransactionTraces);

  const parsedEventsFromReceipt = await parseEventsFromReceiptForEntireTxWithoutDbUsage(txHash);
  if (!parsedEventsFromReceipt) return null;
  // console.log('parsedEventsFromReceipt', parsedEventsFromReceipt);

  const mergedTransfers = mergeAndFilterTransfers(tokenTransfersFromTransactionTraces, parsedEventsFromReceipt);
  // console.log("mergedTransfers", mergedTransfers);

  // const transfersFromReceipt = convertEventsToTransfers(parsedEventsFromReceipt);
  // console.log(transfersFromReceipt);

  const readableTransfers = await makeTransfersReadable(mergedTransfers);
  // console.log("readableTransfers", readableTransfers);

  const updatedReadableTransfers = updateTransferList(readableTransfers, to);
  // console.log("updatedReadableTransfers", updatedReadableTransfers);

  const correctTrasfers = filterForCorrectTransfers(updatedReadableTransfers);
  // console.log("correctTrasfers", correctTrasfers);

  const cleanedTransfers = removeDuplicatesAndUpdatePositions(correctTrasfers);
  // console.log("cleanedTransfers", cleanedTransfers);

  return cleanedTransfers;
}
