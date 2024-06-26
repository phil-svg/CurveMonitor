import { CurrentBlock } from '../../models/CurrentBlock.js';
import EventEmitter from '../goingLive/EventEmitter.js';
import eventEmitter from '../goingLive/EventEmitter.js';
import { WEB3_WS_PROVIDER, getBlockTimeStampFromNode, getCurrentBlockNumber } from '../web3Calls/generic.js';
import { writeBlock } from './Blocks.js';
// Function to get the current block number
export async function getCurrentBlockNumberFromLocalDB() {
    const blockData = await CurrentBlock.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.blockNumber) || null;
}
// Function to update the current block number
export async function updateCurrentBlockNumber(blockNumber) {
    const [currentBlock, created] = await CurrentBlock.findOrCreate({
        where: {},
        defaults: { blockNumber: blockNumber },
    });
    if (!created) {
        await currentBlock.update({ blockNumber: blockNumber });
    }
}
async function init() {
    let currentBlockNumber = await getCurrentBlockNumber();
    if (currentBlockNumber !== null) {
        await updateCurrentBlockNumber(currentBlockNumber);
    }
    else {
        console.log('Failed to fetch current blockNumber.');
    }
}
export async function subscribeToNewBlocks(startTime = Date.now()) {
    const RETRY_INTERVAL_MS = 10000; // Retry every 10 seconds
    const MAX_RETRY_DURATION_MS = 120000; // Total retry duration of 2 minutes (120 seconds)
    try {
        await init();
        // Subscribe to new block headers
        WEB3_WS_PROVIDER.eth
            .subscribe('newBlockHeaders', async (error, blockHeader) => {
            if (error) {
                console.error(`Error subscribing to new block headers: ${error}`);
                if (error.message.includes('connection not open')) {
                    // Retry logic with timeout
                    const currentTime = Date.now();
                    if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
                        console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
                        setTimeout(() => subscribeToNewBlocks(startTime), RETRY_INTERVAL_MS);
                    }
                    else {
                        console.error('Failed to subscribe to new block headers after 2 minutes.');
                    }
                }
                return;
            }
            if (blockHeader.number !== null) {
                await updateCurrentBlockNumber(blockHeader.number); // updating the latest block in the db
                const timestamp = await getBlockTimeStampFromNode(blockHeader.number); // fetching the timestamp of the new block
                if (!timestamp)
                    return;
                await writeBlock(blockHeader.number, timestamp); // writing the timestamp to db
                eventEmitter.emit('new block spotted', blockHeader.number); // emitting new block event for live-parser
            }
        })
            .on('error', console.error);
    }
    catch (err) {
        console.error(`An error occurred in subscribeToNewBlocks: ${err.message}`);
        const currentTime = Date.now();
        if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
            console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
            setTimeout(() => subscribeToNewBlocks(startTime), RETRY_INTERVAL_MS);
        }
        else {
            console.error('Failed to subscribe to new block headers after 2 minutes.');
        }
    }
    EventEmitter.on('dead websocket connection', async () => {
        return;
    });
}
//# sourceMappingURL=CurrentBlock.js.map