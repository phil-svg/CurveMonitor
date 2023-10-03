import { updateAbisFromTrace } from "../../../helperFunctions/Abi.js";
import { parseEventsFromReceiptForEntireTx } from "../../../txMap/Events.js";
import { getCategorizedTransfersFromTxTrace } from "../../../txMap/TransferCategories.js";
import {
  addMissingWethTransfers,
  getTokenTransfersFromTransactionTrace,
  makeTransfersReadable,
  mergeAndFilterTransfers,
  removeDuplicatesAndUpdatePositions,
} from "../../../txMap/TransferOverview.js";
import { extractTransactionAddresses, getTransactionDetailsByTxHash } from "../../readFunctions/TransactionDetails.js";
import { getTransactionTraceFromDb } from "../../readFunctions/TransactionTrace.js";
import { getTxHashByTxId } from "../../readFunctions/Transactions.js";
import { solveAtomicArb } from "./utils/atomicArbDetection.js";

async function fetchDataThenDetectArb(txHash: string) {
  const transactionDetails = await getTransactionDetailsByTxHash(txHash!);
  if (!transactionDetails) return;

  const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
  if (!from || !to) {
    console.log(`Failed to fetch transactionDetails during arb detection for ${txHash} with ${transactionDetails},${from},${to}`);
    return;
  }

  const transactionTraces = await getTransactionTraceFromDb(txHash!);

  // making sure we have all ABIs which are relevant in this tx.
  await updateAbisFromTrace(transactionTraces);

  const tokenTransfersFromTransactionTraces = await getTokenTransfersFromTransactionTrace(transactionTraces);
  // console.log("tokenTransfersFromTransactionTraces", tokenTransfersFromTransactionTraces);

  const parsedEventsFromReceipt = await parseEventsFromReceiptForEntireTx(txHash!);
  // console.log("parsedEventsFromReceipt", parsedEventsFromReceipt);

  const mergedTransfers = mergeAndFilterTransfers(tokenTransfersFromTransactionTraces, parsedEventsFromReceipt);
  // console.log("mergedTransfers", mergedTransfers);

  const readableTransfers = await makeTransfersReadable(mergedTransfers);
  // console.log("readableTransfers", readableTransfers);

  const updatedReadableTransfers = addMissingWethTransfers(readableTransfers);
  // console.log("updatedReadableTransfers", updatedReadableTransfers);

  const cleanedTransfers = removeDuplicatesAndUpdatePositions(updatedReadableTransfers);
  // console.log("cleanedTransfers", cleanedTransfers);

  await solveAtomicArb(txHash!, cleanedTransfers, from, to);
}

export async function updateAtomicArbDetection() {
  // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // guy withdrawing from pool, receives 3 Token, solved
  // const txHash = "0x1c7e8861744c00a063295987b69bbb82e1bab9c1afd438219cfa5a8d3f98dbdf"; // Balancer, Uni v2, Uni v3, Curve, solved
  // const txHash = "0xf0607901716acb0086a58e52464d4b481b386e348214bf8fae300c3fc3a6e423"; // arb, solved
  // const txHash = "0xd602f90c5e9e60a1f55b7399a3226448a8b9c09f2d2a347bc88570827c7e157e"; // solved
  // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // todo
  // const txHash = "0x315f986874fd44b23c5c7a61638a915f5763c0b79c259aa808b1b769cc21c870"; // todo

  const txId = 33;
  const txHash = await getTxHashByTxId(txId);
  // await solveAtomicArbForTxHash(txHash!);

  // const txHash = await getTxHashByTxId(116);

  // for (let txId = 100; txId < 200; txId++) {
  //   const txHash = await getTxHashByTxId(txId);
  //   console.log("\n", txId, txHash);
  //   await solveAtomicArbForTxHash(txHash!);
  // }

  await fetchDataThenDetectArb(txHash!);
  console.log("\ntxHash", txHash);

  process.exit();
}

// WETH mint missing in extractTokenTransfers() in tokenMovementSolver
