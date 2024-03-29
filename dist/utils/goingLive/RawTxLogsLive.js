import { TransactionDetails } from "../../models/TransactionDetails.js";
import { eventFlags } from "../api/utils/EventFlags.js";
import { getContractByAddressWithWebsocket } from "../helperFunctions/Web3.js";
import { fetchContractAgeInRealtime } from "../postgresTables/ContractCreations.js";
import { storeEvent } from "../postgresTables/RawLogs.js";
import { solveSingleTdId } from "../postgresTables/TransactionsDetails.js";
import { findCandidatesInBatch } from "../postgresTables/mevDetection/sandwich/SandwichDetection.js";
import { addAddressesForLabelingForBlock } from "../postgresTables/mevDetection/sandwich/SandwichUtils.js";
import { getTimestampsByBlockNumbersFromLocalDatabase } from "../postgresTables/readFunctions/Blocks.js";
import { getCoinsInBatchesByPools, getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { fetchEventsForChunkParsing } from "../postgresTables/readFunctions/RawLogs.js";
import { fetchTransactionsForBlock } from "../postgresTables/readFunctions/Transactions.js";
import { sortAndProcess } from "../postgresTables/txParsing/ParseTx.js";
import eventEmitter from "./EventEmitter.js";
import { getCurrentFormattedTime } from "../helperFunctions/QualityOfLifeStuff.js";
import EventEmitter from "./EventEmitter.js";
// when histo-parsing is finished, subscribe to new events.
export async function preparingLiveModeForRawEvents() {
    eventEmitter.on("ready for subscription", subscribeToAddress);
    eventEmitter.on("new block spotted", processBufferedEvents);
    EventEmitter.on("dead websocket connection", async () => {
        return;
    });
}
let eventBuffer = [];
async function getPoolCoinsForLiveMode() {
    const poolAddresses = eventBuffer.map((event) => event.address); // Get all addresses from the events
    const poolIdsPromises = poolAddresses.map(getIdByAddress); // Convert each address to a Promise<id>
    const poolIds = await Promise.all(poolIdsPromises); // Await all promises to get an array of ids
    const validPoolIds = poolIds.filter((id) => id !== null);
    const POOL_COINS = await getCoinsInBatchesByPools(validPoolIds);
    return POOL_COINS;
}
function bufferEvent(address, event) {
    if (!eventBuffer.some((e) => e.address === address && JSON.stringify(e.event) === JSON.stringify(event))) {
        eventBuffer.push({ address, event });
    }
}
// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
export async function subscribeToAddress(address) {
    const contract = await getContractByAddressWithWebsocket(address);
    const poolId = await getIdByAddress(address);
    if (!contract)
        return;
    if (!poolId)
        return;
    const subscription = contract.events
        .allEvents({ fromBlock: "latest" })
        .on("data", async (event) => {
        console.log(`New Event spotted at ${getCurrentFormattedTime()}`);
        // lastEventTime = Date.now();
        await storeEvent(event, poolId);
        bufferEvent(address, event);
    })
        .on("error", (error) => {
        console.log(`Subscription error: ${error}`);
    });
}
async function saveParsedEventInLiveMode(parsedTx) {
    // solving called contract
    const transactionIds = parsedTx.map((tx) => tx.tx_id).filter((id) => id !== undefined);
    const calledContractPromises = transactionIds.map((txId) => solveSingleTdId(txId));
    const calledContractAddresses = await Promise.all(calledContractPromises);
    // Filter out null results
    const validCalledContractAddresses = calledContractAddresses.filter((address) => address !== null);
    // Save to the database + Emit Event
    for (const data of validCalledContractAddresses) {
        try {
            await fetchContractAgeInRealtime(data.hash, data.to);
            const existingTransaction = await TransactionDetails.findOne({ where: { txId: data.txId } });
            if (!existingTransaction) {
                await TransactionDetails.upsert(data);
                if (eventFlags.canEmitGeneralTx) {
                    eventEmitter.emit("New Transaction for General-Transaction-Livestream", data.txId);
                }
            }
        }
        catch (err) {
            console.log(`Failed to solve called contract in live-mode for txId: ${data.txId}`, err);
            console.log(`Data causing error:`, JSON.stringify(data, null, 2));
        }
    }
}
export function getUniqueTransactions(transactions) {
    const uniqueTxHashes = new Set();
    const uniqueTxArray = [];
    for (const tx of transactions) {
        if (!uniqueTxHashes.has(tx.tx_hash)) {
            uniqueTxHashes.add(tx.tx_hash);
            uniqueTxArray.push(tx);
        }
    }
    return uniqueTxArray;
}
// when the next block appears, we parse the prev block.
async function processBufferedEvents() {
    if (eventBuffer.length === 0)
        return;
    const eventBlockNumbers = eventBuffer.flatMap((event) => (event.event.blockNumber !== undefined ? [event.event.blockNumber] : []));
    const EVENTS = await fetchEventsForChunkParsing(eventBlockNumbers[0], eventBlockNumbers[eventBlockNumbers.length - 1]);
    const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbersFromLocalDatabase(eventBlockNumbers);
    const POOL_COINS = await getPoolCoinsForLiveMode();
    // Parsing
    await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS);
    eventBuffer = [];
    const PARSED_TX = await fetchTransactionsForBlock(eventBlockNumbers[0]);
    // Saving Parsed Tx to db
    try {
        await saveParsedEventInLiveMode(PARSED_TX);
    }
    catch (err) {
        console.log(`Err in live-mode ${err}`);
    }
    // Sandwich Detection In live-mode
    await findCandidatesInBatch(PARSED_TX);
    await addAddressesForLabelingForBlock(eventBlockNumbers[0]);
    /*
    const processedTxHashes = new Set<string>();
  
    // waiting for traces to be available for pinging.
    await new Promise((resolve) => setTimeout(resolve, 18069));
  
    // trace + receipt + building out live-arb-detection
    const uniqueTransactions = getUniqueTransactions(PARSED_TX);
    for (const tx of uniqueTransactions) {
      const txId = tx.tx_id;
      if (!txId || processedTxHashes.has(tx.tx_hash.toLowerCase())) continue;
  
      // fetching and saving of the transaction-trace
      const transactionTrace = await retryGetTransactionTraceViaWeb3Provider(tx.tx_hash);
      if (!transactionTrace) {
        console.log("failed to fetch transaction-trace during live-mode for", tx.tx_hash);
        continue;
      }
      await saveTransactionTrace(tx.tx_hash, transactionTrace);
  
      const receipt = await fetchAndSaveReceipt(tx.tx_hash, txId);
      if (!receipt) {
        console.log("failed to fetch transaction-receipt during live-mode for", tx.tx_hash);
        continue;
      }
  
      // parsing the entire tx:
      const cleanedTransfers = await solveCleanTransfersForTx(txId);
      if (!cleanedTransfers) continue;
      await insertTokenTransfers(txId, cleanedTransfers);
  
      const atomicArbInfo = await fetchDataThenDetectArb(txId);
      if (eventFlags.canEmitAtomicArb) {
        if (atomicArbInfo && atomicArbInfo !== "not an arb") {
          // creates or updates table entry:
          await insertAtomicArbDetails(txId, atomicArbInfo);
          eventEmitter.emit("New Transaction for Atomic-Arb-Livestream", atomicArbInfo);
        }
      }
  
      const isCexDexArbitrage = await isCexDexArb(txId);
      if (isCexDexArbitrage && isCexDexArbitrage !== "unable to fetch") {
        if (eventFlags.canEmitCexDexArb) {
          eventEmitter.emit("New Transaction for CexDex-Arb-Livestream", txId);
          //saving to db:
          await storeCexDexArbFlag(txId, isCexDexArbitrage);
          await processSinglCexDexTxId(txId);
        }
      }
  
      processedTxHashes.add(tx.tx_hash.toLowerCase());
    }
    */
}
//# sourceMappingURL=RawTxLogsLive.js.map