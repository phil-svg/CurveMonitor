import { TransactionData } from '../../../../models/Transactions.js';
import { fetchTransactionsBatch, getTotalTransactionsCount } from '../../readFunctions/Transactions.js';
import { addAddressesForLabeling, enrichCandidateWithCoinInfo, removeProcessedTransactions } from './SandwichUtils.js';
import { screenCandidate } from './SandwichCandidateScreening.js';
import { logProgress, updateConsoleOutput } from '../../../helperFunctions/QualityOfLifeStuff.js';
import { IsSandwich } from '../../../../models/IsSandwich.js';
import { sequelize } from '../../../../config/Database.js';
import { QueryTypes } from 'sequelize';

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

export async function getUncheckedTransactionsForSandwichDetection(
  offset: number,
  BATCH_SIZE: number
): Promise<TransactionData[]> {
  const query = `
        SELECT 
            t.tx_id, t.pool_id, t.event_id, t.tx_hash, t.block_number, t.block_unixtime,
            t.transaction_type, t.trader, t.tx_position, t.raw_fees, t.fee_usd, t.value_usd
        FROM 
            transactions t
        LEFT JOIN 
            is_sandwich isw ON t.tx_id = isw.tx_id
        WHERE 
            isw.tx_id IS NULL
        ORDER BY 
            t.block_number ASC, t.pool_id ASC
        LIMIT 
            :BATCH_SIZE
        OFFSET 
            :offset;
    `;

  const result = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
    replacements: { BATCH_SIZE, offset },
  });

  return result as TransactionData[];
}

interface CountResult {
  count: string;
}

export async function getUncheckedTransactionCount(): Promise<number> {
  const query = `
        SELECT 
            COUNT(*) AS count
        FROM 
            transactions t
        LEFT JOIN 
            is_sandwich isw ON t.tx_id = isw.tx_id
        WHERE 
            isw.tx_id IS NULL;
    `;

  const result = await sequelize.query<CountResult>(query, {
    type: QueryTypes.SELECT,
    raw: true,
  });

  const countNumber: number = parseInt(result[0].count, 10);

  return countNumber;
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
  const totalUncheckedCount = await getUncheckedTransactionCount();
  let totalTransactionsCount = await getTotalTransactionsCount();

  let batchSize;
  if (totalUncheckedCount < 10000) {
    batchSize = totalTransactionsCount + 1000;
  } else {
    let tenKChunks = totalUncheckedCount / 10000;
    batchSize = totalTransactionsCount / tenKChunks;
  }

  let offset = 0;
  let totalTimeTaken = 0;
  let numberOfTxToCheckLeft = totalTransactionsCount;

  while (true) {
    const start = new Date().getTime();

    const filteredTransactions = await getUncheckedTransactionsForSandwichDetection(offset, batchSize);

    await findCandidatesInBatch(filteredTransactions);

    offset += batchSize;
    numberOfTxToCheckLeft -= batchSize;

    const end = new Date().getTime();
    totalTimeTaken += end - start;
    logProgress(
      'Sandwich-Detection',
      1,
      offset,
      totalTimeTaken,
      batchSize * Math.ceil(totalTransactionsCount / batchSize)
    );

    if (numberOfTxToCheckLeft <= 0) break;
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
    console.log('Failed to enrich Condidate', candidate);
    return;
  }
  await screenCandidate(enrichedCandidate);
}

export async function updateSandwichDetection(): Promise<void> {
  await detectSandwichesInAllTransactions();
  await addAddressesForLabeling();
  updateConsoleOutput('[✓] Sandwich-Detection completed successfully.\n');
}
