import { TokenTransfers } from "../../models/CleanedTransfers.js";
import { ReadableTokenTransfer } from "../Interfaces.js";
import { getCleanedTransfers } from "./mevDetection/atomic/atomicArb.js";
import { getAllTxIdsFromCleanedTransfers } from "./readFunctions/CleanedTransfers.js";
import { extractTransactionAddresses, getTransactionDetails } from "./readFunctions/TransactionDetails.js";
import { getAllTransactionIds, getTxHashByTxId } from "./readFunctions/Transactions.js";
import { logProgress } from "../helperFunctions/QualityOfLifeStuff.js";

export async function insertTokenTransfers(txId: number, transfers: ReadableTokenTransfer[]): Promise<void> {
  try {
    await TokenTransfers.upsert({
      tx_id: txId,
      cleaned_transfers: transfers,
    });
  } catch (error) {
    console.error("Error inserting token transfers:", error);
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

export async function updateCleanedTransfers() {
  const transactionIds = await getAllTransactionIds();
  const allSolvedTransferTxIds = await getAllTxIdsFromCleanedTransfers();
  const solvedTransferTxIdsSet = new Set(allSolvedTransferTxIds);
  const todoTransactionIds = transactionIds.filter((txId) => !solvedTransferTxIdsSet.has(txId));

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
    if (counter % 1000 === 0) {
      for (let key in cleanedTransfersCache) {
        if (cleanedTransfersCache.hasOwnProperty(key)) {
          delete cleanedTransfersCache[key];
        }
      }
    }
    logProgress("updateCleanedTransfers", 400, counter, totalTimeTaken, totalToBeProcessed);
  }

  console.log(`[✓] updateCleanedTransfers completed successfully.`);
}
