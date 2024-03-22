import { logProgress } from "../../../helperFunctions/QualityOfLifeStuff.js";
import { getUnstoredCexDexArbTxIds, getUnstoredCexDexArbTxIdsForSinglePool, saveCexDexArb } from "../../CexDexArbs.js";
import { storeCexDexArbFlag } from "../../IsCexDexArb.js";
import { getAllTxIdsFromCleanedTransfers } from "../../readFunctions/CleanedTransfers.js";
import { getAllPoolIds } from "../../readFunctions/Pools.js";
import { getToAddress } from "../../readFunctions/TransactionDetails.js";
import { getPoolIdByTxId } from "../../readFunctions/Transactions.js";
import { filterProcessedTxIds } from "./Helpers.js";
import { isCexDexArb } from "./utils/cexdexDetection.js";

async function processSingleTxId(txId: number, poolId: number): Promise<void> {
  const botAddress = await getToAddress(txId);
  await saveCexDexArb(txId, botAddress, poolId);
}

export async function processSinglCexDexTxId(txId: number): Promise<void> {
  const botAddress = await getToAddress(txId);
  const poolId = await getPoolIdByTxId(txId);
  if (!poolId) return;
  await saveCexDexArb(txId, botAddress, poolId);
}

async function processSinglePool(poolId: number): Promise<void> {
  const unstoredCexDexArbTxIds = await getUnstoredCexDexArbTxIdsForSinglePool(poolId);
  for (const txId of unstoredCexDexArbTxIds) {
    await processSingleTxId(txId, poolId);
  }
}

export async function updateCexDexArbTableOld(): Promise<void> {
  const allPoolIds = await getAllPoolIds();
  const sortedPoolIds = allPoolIds.sort((a, b) => a - b);

  let counter = 0;
  let totalTimeTaken = 0;
  const totalToBeProcessed = sortedPoolIds.length;

  for (const poolId of sortedPoolIds) {
    const start = new Date().getTime();
    await processSinglePool(poolId);
    const end = new Date().getTime();
    totalTimeTaken += end - start;
    counter++;
    logProgress("updating CexDexArb-Table", 100, counter, totalTimeTaken, totalToBeProcessed);
  }
}

export async function updateCexDexArbTable(): Promise<void> {
  let counter = 0;
  let totalTimeTaken = 0;

  const unstoredCexDexArbTxIds = await getUnstoredCexDexArbTxIds();
  for (const txId of unstoredCexDexArbTxIds) {
    const start = new Date().getTime();
    const poolId = await getPoolIdByTxId(txId);
    await processSingleTxId(txId, poolId!);
    const end = new Date().getTime();
    totalTimeTaken += end - start;
    counter++;
    logProgress("updating CexDexArb-Table", 100, counter, totalTimeTaken, unstoredCexDexArbTxIds.length);
  }
}

export async function solveAndStoreCexDexArbFlag(): Promise<void> {
  let counter = 0;
  let totalTimeTaken = 0;

  const allTxIds = await getAllTxIdsFromCleanedTransfers();
  const unprocessedTxIds = await filterProcessedTxIds(allTxIds);

  for (const txId of unprocessedTxIds) {
    const start = new Date().getTime();
    counter++;

    // if (txId !== 832537) continue;

    // const poolId = await getPoolIdByTxId(txId);
    // if (!poolId) continue;
    // if (poolId !== 639) continue; // filtering for only tricryptoUSDC 333,639,640

    const arbStatus = await isCexDexArb(txId);
    if (arbStatus === "unable to fetch") {
      // If unable to fetch, log the progress and continue to the next iteration
      const end = new Date().getTime();
      totalTimeTaken += end - start;
      logProgress("solving and storing CexDexArbFlags", 200, counter, totalTimeTaken, unprocessedTxIds.length);
      continue;
    }

    await storeCexDexArbFlag(txId, arbStatus);

    const end = new Date().getTime();
    totalTimeTaken += end - start;

    logProgress("solving and storing CexDexArbFlags", 200, counter, totalTimeTaken, unprocessedTxIds.length);
  }

  console.log(`[✓] CexDexArbFlags synced successfully.`);
}

export async function updateCexDexArbDetection() {
  await solveAndStoreCexDexArbFlag();
  await updateCexDexArbTable();
  console.log(`[✓] CexDexArbs synced successfully.`);
}
