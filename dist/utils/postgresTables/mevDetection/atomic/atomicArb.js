import { updateAbisFromTrace } from "../../../helperFunctions/Abi.js";
import { parseEventsFromReceiptForEntireTx } from "../../../txMap/Events.js";
import { getTokenTransfersFromTransactionTrace, makeTransfersReadable, mergeAndFilterTransfers, removeDuplicatesAndUpdatePositions, updateTransferList, } from "../../../txMap/TransferOverview.js";
import { extractTransactionAddresses, getTransactionDetails } from "../../readFunctions/TransactionDetails.js";
import { getTransactionTraceFromDb } from "../../readFunctions/TransactionTrace.js";
import { getTxHashByTxId, getTxIdByTxHash } from "../../readFunctions/Transactions.js";
import { solveAtomicArb } from "./utils/atomicArbDetection.js";
import { clearCaches } from "../../../helperFunctions/QualityOfLifeStuff.js";
export async function fetchDataThenDetectArb(txId) {
    const txHash = await getTxHashByTxId(txId);
    if (!txHash) {
        console.log("failed to fetch txHash for txId", txId);
        return null;
    }
    const transactionDetails = await getTransactionDetails(txId);
    if (!transactionDetails)
        return null;
    const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
    if (!from || !to) {
        console.log(`Failed to fetch transactionDetails during arb detection for ${txHash} with ${transactionDetails},${from},${to}`);
        return null;
    }
    const transactionTraces = await getTransactionTraceFromDb(txHash);
    if (transactionTraces.length <= 1) {
        console.log("alchemy trace api bugged out for", txHash);
        return null;
    }
    // making sure we have all ABIs which are relevant in this tx.
    await updateAbisFromTrace(transactionTraces);
    const tokenTransfersFromTransactionTraces = await getTokenTransfersFromTransactionTrace(transactionTraces);
    // console.log("tokenTransfersFromTransactionTraces", tokenTransfersFromTransactionTraces);
    const parsedEventsFromReceipt = await parseEventsFromReceiptForEntireTx(txHash);
    // console.log("parsedEventsFromReceipt", parsedEventsFromReceipt);
    if (!parsedEventsFromReceipt)
        return null;
    const mergedTransfers = mergeAndFilterTransfers(tokenTransfersFromTransactionTraces, parsedEventsFromReceipt);
    // console.log("mergedTransfers", mergedTransfers);
    const readableTransfers = await makeTransfersReadable(mergedTransfers);
    // console.log("readableTransfers", readableTransfers);
    const updatedReadableTransfers = updateTransferList(readableTransfers, to);
    // console.log("updatedReadableTransfers", updatedReadableTransfers);
    const cleanedTransfers = removeDuplicatesAndUpdatePositions(updatedReadableTransfers);
    // console.log("cleanedTransfers", cleanedTransfers);
    const atomicArbDetails = await solveAtomicArb(txId, txHash, cleanedTransfers, from, to);
    clearCaches();
    return atomicArbDetails;
}
export async function updateAtomicArbDetection() {
    // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // guy withdrawing from pool, receives 3 Token, solved
    // const txHash = "0x1c7e8861744c00a063295987b69bbb82e1bab9c1afd438219cfa5a8d3f98dbdf"; // Balancer, Uni v2, Uni v3, Curve, solved
    // const txHash = "0xf0607901716acb0086a58e52464d4b481b386e348214bf8fae300c3fc3a6e423"; // arb, solved
    // const txHash = "0xd602f90c5e9e60a1f55b7399a3226448a8b9c09f2d2a347bc88570827c7e157e"; // solved
    // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // solved!
    // const txHash = "0x76f2b5ccaa420ce744b5bfa015b3ba47b4ee0d6b89a0a1a5483c8576b90ba7ba"; // solved!
    const txHash = "0x432eed35a24bf60b8d2ff62141eb2adf5270e6e0b3d886e20f1cf3f51de318be";
    const txId = await getTxIdByTxHash(txHash);
    // console.time();
    // const txId = 930;
    await fetchDataThenDetectArb(txId);
    // console.timeEnd();
    // console.log("\ntxHash", txHash);
    // console.time();
    // for (let txId = 1; txId <= 1000; txId++) {
    //   console.log("txId", txId);
    //   await fetchDataThenDetectArb(txId);
    // }
    // console.timeEnd();
    process.exit();
}
//# sourceMappingURL=atomicArb.js.map