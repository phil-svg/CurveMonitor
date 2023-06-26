import { getAllPoolAddresses, getIdByAddress } from "./readFunctions/Pools.js";
import { getContractByAddress } from "../helperFunctions/Web3.js";
import { getPastEvents } from "../web3Calls/generic.js";
import { RawTxLogs } from "../../models/RawTxLogs.js";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { getRawLogsFromBlock, getRawLogsToBlock, updateRawLogsFromBlock, updateRawLogsToBlock } from "./readFunctions/BlockScanningData.js";
import { getCurrentBlockNumberFromLocalDB } from "./CurrentBlock.js";
import eventEmitter from "../goingLive/EventEmitter.js";
import { retry } from "../helperFunctions/Web3Retry.js";
export async function storeEvent(event, poolId) {
    const { address, blockHash, blockNumber, logIndex, removed, transactionHash, transactionIndex, id, returnValues, event: eventName, signature, raw } = event;
    try {
        await RawTxLogs.create({
            pool_id: poolId,
            address,
            blockNumber,
            transactionHash,
            transactionIndex,
            blockHash,
            logIndex,
            removed,
            log_id: id,
            returnValues,
            event: eventName,
            signature,
            raw,
        });
    }
    catch (error) {
        if (error.name !== "SequelizeUniqueConstraintError") {
            throw error;
        }
    }
}
async function processPastEvents(pastEvents, poolId, poolAddress, fromBlock, toBlock, currentToBlock) {
    const progressPercentage = ((currentToBlock - fromBlock) / (toBlock - fromBlock)) * 100;
    const message = `Fetching Raw Logs for: ${poolAddress} ${progressPercentage.toFixed(0)}%`;
    // updateConsoleOutput(message, 1);
    for (const event of pastEvents) {
        await storeEvent(event, poolId);
    }
    return {
        newFromBlock: currentToBlock,
        newToBlock: toBlock,
    };
}
async function processAddress(poolAddress, fromBlock, toBlock) {
    const POOL_ID = await getIdByAddress(poolAddress);
    if (!POOL_ID)
        return;
    const CONTRACT = await getContractByAddress(poolAddress);
    if (!CONTRACT)
        return;
    let currentFromBlock = fromBlock;
    let currentToBlock = toBlock;
    while (currentFromBlock < currentToBlock) {
        const PAST_EVENTS = await retry(() => getPastEvents(CONTRACT, "allEvents", currentFromBlock, currentToBlock));
        if (PAST_EVENTS === null) {
            console.error("Invalid block range");
            return;
        }
        else if ("start" in PAST_EVENTS) {
            currentToBlock = PAST_EVENTS.end;
        }
        else if (Array.isArray(PAST_EVENTS)) {
            const { newFromBlock, newToBlock } = await processPastEvents(PAST_EVENTS, POOL_ID, poolAddress, fromBlock, toBlock, currentToBlock);
            currentFromBlock = newFromBlock;
            currentToBlock = newToBlock;
        }
        else {
            console.log("Err in processing Address.");
        }
    }
}
async function processBlocksUntilCurrent(address, fromBlock) {
    while (true) {
        let currentBlockNumber = await getCurrentBlockNumberFromLocalDB();
        if (currentBlockNumber === null) {
            console.error("Failed to fetch current block number");
            return;
        }
        if (fromBlock < currentBlockNumber) {
            await processAddress(address, fromBlock + 1, currentBlockNumber);
            fromBlock = currentBlockNumber;
        }
        let updatedBlockNumber = await getCurrentBlockNumberFromLocalDB();
        if (updatedBlockNumber === null || updatedBlockNumber !== currentBlockNumber) {
            continue;
        }
        else {
            eventEmitter.emit("ready for subscription", address);
            return;
        }
    }
}
async function processAllAddressesSequentially(addresses) {
    let fromBlock = 17307083;
    let nowBlock = await getCurrentBlockNumberFromLocalDB();
    let smallestBlockNumberStored = await getRawLogsFromBlock();
    let largestBlockNumberStored = await getRawLogsToBlock();
    // Case: We have events fetched, but not as far back in time as fromBlock dictates, so we fetch the missing section.
    if (smallestBlockNumberStored && fromBlock < smallestBlockNumberStored) {
        for (let i = 0; i < addresses.length; i++) {
            // displayProgressBar("Fetching Raw Logs:", i + 1, addresses.length);
            await processAddress(addresses[i], fromBlock, smallestBlockNumberStored - 1);
        }
    }
    for (let i = 0; i < addresses.length; i++) {
        // displayProgressBar("Fetching Raw Logs and Subscribing:", i + 1, addresses.length);
        console.log("Fetching Raw Logs and Subscribing:", i + 1, addresses.length);
        if (!largestBlockNumberStored)
            largestBlockNumberStored = fromBlock;
        await processBlocksUntilCurrent(addresses[i], largestBlockNumberStored);
    }
    await updateRawLogsFromBlock(fromBlock);
    if (nowBlock)
        await updateRawLogsToBlock(nowBlock);
}
export async function updateRawLogs() {
    const ALL_POOL_ADDRESSES = await getAllPoolAddresses();
    try {
        await processAllAddressesSequentially(ALL_POOL_ADDRESSES);
        updateConsoleOutput("[✓] Raw Logs updated successfully.\n");
    }
    catch (error) {
        console.error("Error processing addresses:", error);
    }
}
//# sourceMappingURL=RawLogs.js.map