import { getCurrentTimeString } from "../helperFunctions/QualityOfLifeStuff.js";
import { getContractByAddressWithWebsocket } from "../helperFunctions/Web3.js";
import { storeEvent } from "../postgresTables/RawLogs.js";
import { findCandidatesInBatch } from "../postgresTables/mevDetection/SandwichDetection.js";
import { addAddressesForLabelingForBlock } from "../postgresTables/mevDetection/SandwichUtils.js";
import { getTimestampsByBlockNumbersFromLocalDatabase } from "../postgresTables/readFunctions/Blocks.js";
import { getCoinsInBatchesByPools, getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { fetchEventsForBlockNumberRange } from "../postgresTables/readFunctions/RawLogs.js";
import { fetchTransactionsForBlock } from "../postgresTables/readFunctions/Transactions.js";
import { sortAndProcess } from "../postgresTables/txParsing/ParseTx.js";
import eventEmitter from "./EventEmitter.js";
// when histo-parsing is finished, subscribe to new events.
export async function preparingLiveModeForRawEvents() {
    eventEmitter.on("ready for subscription", subscribeToAddress);
    eventEmitter.on("new block spotted", processBufferedEvents);
}
// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
async function subscribeToAddress(address) {
    const contract = await getContractByAddressWithWebsocket(address);
    const poolId = await getIdByAddress(address);
    if (!contract)
        return;
    if (!poolId)
        return;
    contract.events
        .allEvents({ fromBlock: "latest" })
        .on("data", async (event) => {
        await storeEvent(event, poolId); // saving raw log in db
        bufferEvent(address, event); // temp storing event for parsing
    })
        .on("error", console.error);
}
let eventBuffer = [];
function bufferEvent(address, event) {
    eventBuffer.push({ address, event });
}
// when the next block appears, we parse the prev block.
async function processBufferedEvents() {
    if (eventBuffer.length === 0)
        return;
    const eventBlockNumbers = eventBuffer.flatMap((event) => (event.event.blockNumber !== undefined ? [event.event.blockNumber] : []));
    const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbersFromLocalDatabase(eventBlockNumbers);
    const poolAddresses = eventBuffer.map((event) => event.address); // Get all addresses from the events
    const poolIdsPromises = poolAddresses.map(getIdByAddress); // Convert each address to a Promise<id>
    const poolIds = await Promise.all(poolIdsPromises); // Await all promises to get an array of ids
    const validPoolIds = poolIds.filter((id) => id !== null);
    const POOL_COINS = await getCoinsInBatchesByPools(validPoolIds);
    const EVENTS = await fetchEventsForBlockNumberRange(eventBlockNumbers[0], eventBlockNumbers[eventBlockNumbers.length - 1]);
    const timeStr = getCurrentTimeString();
    // console.log(`\n${timeStr} New Event(s) picked up`);
    // console.dir(EVENTS, { depth: null, colors: true });
    await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS);
    eventBuffer = [];
    let parsedTx = await fetchTransactionsForBlock(eventBlockNumbers[0]);
    await findCandidatesInBatch(parsedTx);
    await addAddressesForLabelingForBlock(eventBlockNumbers[0]);
}
//# sourceMappingURL=RawTxLogsLive.js.map