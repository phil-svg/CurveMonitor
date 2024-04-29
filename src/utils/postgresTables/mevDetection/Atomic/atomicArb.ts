import { extractTransactionAddresses, getTransactionDetails } from '../../readFunctions/TransactionDetails.js';
import { getTxHashByTxId, getTxIdByTxHash } from '../../readFunctions/Transactions.js';
import { solveAtomicArb } from './utils/atomicArbDetection.js';
import { logMemoryUsage, logProgress } from '../../../helperFunctions/QualityOfLifeStuff.js';
import { ReadableTokenTransfer, TransactionDetailsForAtomicArbs } from '../../../Interfaces.js';
import { getCleanedTransfersForTxIdFromTable } from '../../readFunctions/CleanedTransfers.js';
import { getTxIdsWithAtomicArb } from '../../readFunctions/AtomicArbs.js';
import { insertAtomicArbDetails } from '../../AtomicArbs.js';
import { solveTransfersOnTheFlyFlag } from '../../../../App.js';
import { isCexDexArb } from '../cexdex/utils/cexdexDetection.js';
import { getCleanedTransfers } from '../../CleanedTransfers.js';
import { sequelize } from '../../../../config/Database.js';
import { QueryTypes } from 'sequelize';

async function getToDoTxIdsForAtomicArbs(): Promise<number[]> {
  // SQL query to select transaction IDs from transactions table where there is no corresponding entry in the atomic_arbs table
  const query = `
    SELECT t.tx_id
    FROM transactions t
    LEFT JOIN atomic_arbs aa ON t.tx_id = aa.tx_id
    WHERE aa.tx_id IS NULL
    ORDER BY t.tx_id ASC;
  `;

  // Execute the query using sequelize
  const result = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
  });

  // Map the result to return an array of transaction IDs (numbers)
  return result.map((item: any) => item.tx_id);
}

export function filterForCorrectTransfers(transfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  return transfers.filter((transfer) => {
    // Check if token is ETH or WETH
    const isEthOrWeth = ['ETH', 'WETH'].includes(transfer.tokenSymbol || '');

    // Check if amount is greater than 1 billion
    const isAmountGreaterThanBillion = transfer.parsedAmount > 1e9;

    // Return transfers that don't meet both conditions
    return !(isEthOrWeth && isAmountGreaterThanBillion);
  });
}

export async function fetchDataThenDetectArb(
  txId: number
): Promise<TransactionDetailsForAtomicArbs | null | 'not an arb'> {
  const txHash = await getTxHashByTxId(txId);
  if (!txHash) {
    console.log('failed to fetch txHash for txId', txId);
    return null;
  }

  const transactionDetails = await getTransactionDetails(txId);
  if (!transactionDetails) {
    // console.log("transactionDetails are missing in fetchDataThenDetectArb for txId", txId);
    return null;
  }

  const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
  if (!from || !to) {
    // console.log("!from || !to in extractTransactionAddresses in fetchDataThenDetectArb");
    return null;
  }

  let cleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
  if (!cleanedTransfers || solveTransfersOnTheFlyFlag) {
    cleanedTransfers = await getCleanedTransfers(txHash, to);
    if (!cleanedTransfers) {
      // console.log("!cleanedTransfers in getCleanedTransfers in fetchDataThenDetectArb");
      return null;
    }
  }

  // console.log("cleanedTransfers", cleanedTransfers);

  const atomicArbDetails = await solveAtomicArb(txId, txHash!, cleanedTransfers, from, to);

  return atomicArbDetails;
}

async function iterateOverPostiveAtomicArbsFromDb() {
  const txIds = await getTxIdsWithAtomicArb();

  // Variation 1: Stop after 5 iterations
  const variation1Stopper = 150;
  for (let i = 0; i < txIds.length && i < variation1Stopper; i++) {
    const txId = txIds[i];
    const txHash = await getTxHashByTxId(txId);
    console.log('\ntxHash', txHash, 'step:', i, 'result:');
    await fetchDataThenDetectArb(txId);
  }

  // Variation 2: Iterate over a range (from 10th to 20th entry)
  // for (let i = 9; i < txIds.length && i < 20; i++) {
  //   const txId = txIds[i];
  //   await fetchDataThenDetectArb(txId);
  // }
}

export async function checkSingleTxForArbForDebugging() {
  // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // solved, guy withdrawing from pool, receives 3 Token
  // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // milestone solved!
  // const txHash = "1234567890abcdef";
  const txHash = '0x0e2011368731996da961aad9539814cf353b0b55fc2da07c138f6f2c77414b2f';
  const txId = await getTxIdByTxHash(txHash);
  const arbDetails = await fetchDataThenDetectArb(txId!);
  console.log('atomic arbDetails', arbDetails);

  const arbStatus = await isCexDexArb(txId!);
  console.log('cexdex arbStatus', arbStatus);

  // await iterateOverPostiveAtomicArbsFromDb();
  process.exit();
}

export async function updateAtomicArbDetection() {
  const uncheckedTransactionIds = await getToDoTxIdsForAtomicArbs();
  let totalTimeTaken = 0;
  let counter = 0;

  for (const txId of uncheckedTransactionIds) {
    const start = new Date().getTime();
    counter++;

    const res = await fetchDataThenDetectArb(txId);
    if (res) await insertAtomicArbDetails(txId, res);

    const end = new Date().getTime();
    totalTimeTaken += end - start;
    if (counter > 500) {
      logProgress('updateAtomicArbDetection', 100, counter, totalTimeTaken, uncheckedTransactionIds.length);
    }
  }

  console.log(`[✓] atomic arb detection completed successfully.`);
}
