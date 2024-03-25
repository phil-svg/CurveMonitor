import { TransactionData } from "../../../../models/Transactions.js";
import { fetchTransactionsBatch, getTotalTransactionsCount } from "../../readFunctions/Transactions.js";
import { addAddressesForLabeling, enrichCandidateWithCoinInfo, removeProcessedTransactions } from "./SandwichUtils.js";
import { screenCandidate } from "./SandwichCandidateScreening.js";
import { logProgress, updateConsoleOutput } from "../../../helperFunctions/QualityOfLifeStuff.js";
import { IsSandwich } from "../../../../models/IsSandwich.js";

export async function updateSandwichFlagForSingleTx(txID: number, isSandwich: boolean): Promise<void> {
  try {
    await IsSandwich.upsert({
      tx_id: txID,
      is_sandwich: isSandwich,
    });
  } catch (error) {
    console.error(`Error updating flag for txID ${txID}:`, error);
  }
}

/**
 * Explanation for the term "Candidate":
 * A Candidate is basically an array of transactions.
 * These tx occured in the same pool in the same block.
 * Requirment is at least 2 tx, otherwise there is no possibilty for a sandwich.
 *
 * This Array is considered a Candidate for a Sandwich, and will then get screened for mev.
 */

// queries the db, and runs the parsed tx in batches through the detection process.
async function detectSandwichesInAllTransactions(): Promise<void> {
  let totalTransactionsCount = await getTotalTransactionsCount();
  const BATCH_SIZE = 4000000; // works locally, fries the server
  // const BATCH_SIZE = 100000;
  let offset = 0;
  let totalTimeTaken = 0;

  const sandwichFlags = await IsSandwich.findAll({
    attributes: ["tx_id"],
  });

  while (true) {
    const start = new Date().getTime();

    const transactions = await fetchTransactionsBatch(offset, BATCH_SIZE);
    if (transactions.length === 0) break;

    const filteredTransactions = await removeProcessedTransactions(transactions, sandwichFlags);

    await findCandidatesInBatch(filteredTransactions);

    offset += BATCH_SIZE;

    const end = new Date().getTime();
    totalTimeTaken += end - start;
    logProgress("Sandwich-Detection", 1, offset, totalTimeTaken, BATCH_SIZE * Math.ceil(totalTransactionsCount / BATCH_SIZE));
  }
}

// filters the batches for multiple tx in the same pool in the same block. Runs the filtered data further down the detection process.
export async function findCandidatesInBatch(batch: TransactionData[]): Promise<void> {
  const groups: { [key: string]: TransactionData[] } = {};

  // group transactions by `block_number` and `pool_id`
  for (const transaction of batch) {
    const key = `${transaction.block_number}-${transaction.pool_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(transaction);
  }

  await searchInCandidatesClusterForSandwiches(groups);
}

// splits the array of "Candidates" to run them one by one further down the detection process.
async function searchInCandidatesClusterForSandwiches(groups: { [key: string]: TransactionData[] }): Promise<void> {
  for (const key in groups) {
    const candidate = groups[key];

    if (candidate.length > 1) {
      await scanCandidate(candidate);
    }
    if (candidate.length === 1) {
      await updateSandwichFlagForSingleTx(candidate[0].tx_id!, false);
    }
  }
}

// adding coin details
export async function scanCandidate(candidate: TransactionData[]): Promise<void> {
  let enrichedCandidate = await enrichCandidateWithCoinInfo(candidate);
  if (!enrichedCandidate) {
    console.log("Failed to enrich Condidate", candidate);
    return;
  }
  await screenCandidate(enrichedCandidate);
}

export async function updateSandwichDetection(): Promise<void> {
  await detectSandwichesInAllTransactions();
  await addAddressesForLabeling();
  updateConsoleOutput("[✓] Sandwich-Detection completed successfully.\n");
}
