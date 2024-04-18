import { TokenTransfers } from '../../models/CleanedTransfers.js';
import { ReadableTokenTransfer } from '../Interfaces.js';
import { filterForCorrectTransfers, getCleanedTransfers } from './mevDetection/atomic/atomicArb.js';
import { getAllTxIdsFromCleanedTransfers } from './readFunctions/CleanedTransfers.js';
import { extractTransactionAddresses, getTransactionDetails } from './readFunctions/TransactionDetails.js';
import { getAllTransactionIds, getTxHashByTxId } from './readFunctions/Transactions.js';
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
import { parseEventsFromReceiptForEntireTx, parseEventsFromReceiptForEntireTxWithoutDbUsage } from '../txMap/Events.js';
import { sequelize } from '../../config/Database.js';
import { QueryTypes } from 'sequelize';

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

export async function solveCleanTransfersForTx(txId: number): Promise<ReadableTokenTransfer[] | null> {
  const txHash = await getTxHashByTxId(txId);
  if (!txHash) return null;

  const transactionDetails = await getTransactionDetails(txId);
  if (!transactionDetails) return null;

  const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
  if (!from || !to) return null;

  const cleanedTransfers = await getCleanedTransfers(txHash, to);
  if (!cleanedTransfers) return null;

  return cleanedTransfers;
}

async function getToDoTxIdsForCleanTransfers(): Promise<number[]> {
  const query = `
    SELECT t.tx_id
    FROM transactions t
    LEFT JOIN token_transfers tt ON t.tx_id = tt.tx_id
    WHERE tt.tx_id IS NULL
    ORDER BY t.tx_id ASC;
  `;

  const result = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
  });

  return result.map((item: any) => item.tx_id);
}

export async function updateCleanedTransfers() {
  const todoTransactionIds = await getToDoTxIdsForCleanTransfers();

  let counter = 0;
  let totalTimeTaken = 0;
  const totalToBeProcessed = todoTransactionIds.length;
  let cleanedTransfersCache: { [txHash: string]: any } = {};

  // console.log("Solving", totalToBeProcessed, "Transfers");

  for (const txId of todoTransactionIds) {
    counter++;
    const start = new Date().getTime();

    const txHash = await getTxHashByTxId(txId);
    if (!txHash) continue;

    let cleanedTransfers;

    // Check if the txHash already has cleanedTransfers in cache
    if (cleanedTransfersCache[txHash]) {
      cleanedTransfers = cleanedTransfersCache[txHash];
    } else {
      // Solve cleanedTransfers and cache it
      cleanedTransfers = await solveCleanTransfersForTx(txId);
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
