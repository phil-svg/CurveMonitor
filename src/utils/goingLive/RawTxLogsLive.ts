import { TransactionDetails } from "../../models/TransactionDetails.js";
import { eventFlags } from "../api/utils/EventFlags.js";
import { getContractByAddressWithWebsocket } from "../helperFunctions/Web3.js";
import { fetchContractAgeInRealtime } from "../postgresTables/ContractCreations.js";
import { storeEvent } from "../postgresTables/RawLogs.js";
import { fetchAndSaveReceipt } from "../postgresTables/Receipts.js";
import { saveTransactionTrace } from "../postgresTables/TransactionTraces.js";
import { TransactionDetailsCreationAttributes, solveSingleTdId } from "../postgresTables/TransactionsDetails.js";
import { fetchDataThenDetectArb } from "../postgresTables/mevDetection/atomic/atomicArb.js";
import { findCandidatesInBatch } from "../postgresTables/mevDetection/sandwich/SandwichDetection.js";
import { addAddressesForLabelingForBlock } from "../postgresTables/mevDetection/sandwich/SandwichUtils.js";
import { getTimestampsByBlockNumbersFromLocalDatabase } from "../postgresTables/readFunctions/Blocks.js";
import { getCoinsInBatchesByPools, getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { fetchEventsForChunkParsing } from "../postgresTables/readFunctions/RawLogs.js";
import { fetchTransactionsForBlock } from "../postgresTables/readFunctions/Transactions.js";
import { sortAndProcess } from "../postgresTables/txParsing/ParseTx.js";
import { retryGetTransactionTraceViaAlchemy } from "../web3Calls/generic.js";
import eventEmitter from "./EventEmitter.js";

// when histo-parsing is finished, subscribe to new events.
export async function preparingLiveModeForRawEvents(): Promise<void> {
  eventEmitter.on("ready for subscription", subscribeToAddress);
  eventEmitter.on("new block spotted", processBufferedEvents);
}

// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
async function subscribeToAddress(address: string) {
  const contract = await getContractByAddressWithWebsocket(address);
  const poolId = await getIdByAddress(address);

  if (!contract) return;
  if (!poolId) return;

  contract.events
    .allEvents({ fromBlock: "latest" })
    .on("data", async (event: any) => {
      await storeEvent(event, poolId); // saving raw log in db
      bufferEvent(address, event); // temp storing event for parsing
    })
    .on("error", console.error);
}

let eventBuffer: any[] = [];

function bufferEvent(address: string, event: any) {
  if (!eventBuffer.some((e) => e.address === address && JSON.stringify(e.event) === JSON.stringify(event))) {
    eventBuffer.push({ address, event });
  }
}

// when the next block appears, we parse the prev block.
async function processBufferedEvents() {
  if (eventBuffer.length === 0) return;

  const eventBlockNumbers = eventBuffer.flatMap((event) => (event.event.blockNumber !== undefined ? [event.event.blockNumber] : []));

  const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbersFromLocalDatabase(eventBlockNumbers);

  const poolAddresses = eventBuffer.map((event) => event.address); // Get all addresses from the events
  const poolIdsPromises = poolAddresses.map(getIdByAddress); // Convert each address to a Promise<id>
  const poolIds = await Promise.all(poolIdsPromises); // Await all promises to get an array of ids

  const validPoolIds = poolIds.filter((id) => id !== null) as number[];
  const POOL_COINS = await getCoinsInBatchesByPools(validPoolIds);

  const EVENTS = await fetchEventsForChunkParsing(eventBlockNumbers[0], eventBlockNumbers[eventBlockNumbers.length - 1]);

  // parsing and saving the tx
  await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS);
  eventBuffer = [];

  let parsedTx = await fetchTransactionsForBlock(eventBlockNumbers[0]);

  try {
    // solving called contract
    const transactionIds = parsedTx.map((tx) => tx.tx_id).filter((id): id is number => id !== undefined);
    const calledContractPromises = transactionIds.map((txId) => solveSingleTdId(txId));
    const calledContractAddresses = await Promise.all(calledContractPromises);

    // Filter out null results
    const validCalledContractAddresses = calledContractAddresses.filter((address): address is NonNullable<typeof address> => address !== null);

    // Save to the database + Emit Event
    for (const data of validCalledContractAddresses) {
      try {
        await fetchContractAgeInRealtime(data.hash, data.to);

        const existingTransaction = await TransactionDetails.findOne({ where: { txId: data.txId } });

        if (!existingTransaction) {
          await TransactionDetails.upsert(data as TransactionDetailsCreationAttributes);
          if (eventFlags.canEmitGeneralTx) {
            eventEmitter.emit("New Transaction for General-Transaction-Livestream", data.txId);
          }
        }
      } catch (err) {
        console.log(`Failed to solve called contract in live-mode for txId: ${data.txId}`, err);
        console.log(`Data causing error:`, JSON.stringify(data, null, 2));
      }
    }
  } catch (err) {
    console.log(`Err in live-mode ${err}`);
  }

  // live-sandwich-detection
  await findCandidatesInBatch(parsedTx);

  await addAddressesForLabelingForBlock(eventBlockNumbers[0]);

  const processedTxHashes = new Set<string>();

  // waiting for traces to be available for pinging.
  await new Promise((resolve) => setTimeout(resolve, 18069));

  // building out live-arb-detection
  for (const tx of parsedTx) {
    // *********************************************
    console.log("\nlive atomic arb detection: txId", tx.tx_id, "txHash", tx.tx_hash);

    if (!tx.tx_id || processedTxHashes.has(tx.tx_hash.toLowerCase())) continue;

    // fetching and saving of the transaction-trace
    const transactionTrace = await retryGetTransactionTraceViaAlchemy(tx.tx_hash);
    if (!transactionTrace) continue;
    await saveTransactionTrace(tx.tx_hash, transactionTrace);

    await fetchAndSaveReceipt(tx.tx_hash, tx.tx_id);
    const atomicArbInfo = await fetchDataThenDetectArb(tx.tx_id);
    console.log("atomicArbInfo", atomicArbInfo);

    if (eventFlags.canEmitAtomicArb) {
      if (atomicArbInfo) {
        eventEmitter.emit("New Transaction for Atomic-Arb-Livestream", atomicArbInfo);
      }
    }
    // *********************************************

    processedTxHashes.add(tx.tx_hash.toLowerCase());
  }
}
