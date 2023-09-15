import { updateAbisFromTrace } from "../../../helperFunctions/MethodID.js";
import { parseEventsFromReceiptForEntireTx } from "../../../txMap/Events.js";
import { getCategorizedTransfersFromTxTrace } from "../../../txMap/TransferCategories.js";
import {
  addMissingWethTransfers,
  getTokenTransfersFromTransactionTrace,
  makeTransfersReadable,
  mergeAndFilterTransfers,
  removeDuplicatesAndUpdatePositions,
} from "../../../txMap/TransferOverview.js";
import { getTransactionTraceFromDb } from "../../readFunctions/TransactionTrace.js";
import { getTxHashByTxId } from "../../readFunctions/Transactions.js";
import { solveAtomicArb } from "./utils/atomicArbDetection.js";

async function fetchDataThenDetectArb(txHash: string) {
  const transactionTraces = await getTransactionTraceFromDb(txHash!);

  // making sure we have all ABIs which are relevant in this tx.
  // await updateAbisFromTrace(transactionTraces);

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

  // const address = "0x7594F15D27B58C04B82C3891e6f5f4488b2006e0";

  // interface Balance {
  //   tokenSymbol: string;
  //   balance: number;
  // }

  // const balances: Record<string, Balance> = {};

  // cleanedTransfers.forEach((transfer) => {
  //   // If the address is involved in the transaction
  //   if (transfer.from.toLowerCase() === address.toLowerCase() || transfer.to.toLowerCase() === address.toLowerCase()) {
  //     if (!balances[transfer.tokenAddress]) {
  //       balances[transfer.tokenAddress] = {
  //         tokenSymbol: transfer.tokenSymbol!,
  //         balance: 0,
  //       };
  //     }

  //     if (transfer.from.toLowerCase() === address.toLowerCase()) {
  //       balances[transfer.tokenAddress].balance -= transfer.parsedAmount;
  //     }
  //     if (transfer.to.toLowerCase() === address.toLowerCase()) {
  //       balances[transfer.tokenAddress].balance += transfer.parsedAmount;
  //     }
  //   }
  // });

  // console.log(balances);

  const transfersCategorized = await getCategorizedTransfersFromTxTrace(cleanedTransfers);
  // console.dir(transfersCategorized, { depth: null, colors: true });

  // await solveAtomicArb(txHash!, transfersCategorized);
}

export async function updateAtomicArbDetection() {
  // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // guy withdrawing from pool, receives 3 Token.
  // const txHash = "0x1c7e8861744c00a063295987b69bbb82e1bab9c1afd438219cfa5a8d3f98dbdf"; // Balancer, Uni v2, Uni v3, Curve
  // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // todo
  const txHash = "0xf0607901716acb0086a58e52464d4b481b386e348214bf8fae300c3fc3a6e423"; // todo
  // const txHash = "0xd602f90c5e9e60a1f55b7399a3226448a8b9c09f2d2a347bc88570827c7e157e"; // todo

  // const txId = 10;
  // const txHash = await getTxHashByTxId(txId);
  // await solveAtomicArbForTxHash(txHash!);

  // const txHash = await getTxHashByTxId(116);

  // for (let txId = 100; txId < 200; txId++) {
  //   const txHash = await getTxHashByTxId(txId);
  //   console.log("\n", txId, txHash);
  //   await solveAtomicArbForTxHash(txHash!);
  // }

  await fetchDataThenDetectArb(txHash!);
  console.log("txHash", txHash);

  //process.exit();
}

// WETH mint missing in extractTokenTransfers() in tokenMovementSolver
