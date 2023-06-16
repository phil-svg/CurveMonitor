import { CurrentBlock } from "../../models/CurrentBlock.js";
import eventEmitter from "../goingLive/EventEmitter.js";
import { getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { getBlockTimeStamp, getCurrentBlockNumber } from "../web3Calls/generic.js";
import { writeBlock } from "./Blocks.js";
// Function to get the current block number
export async function getCurrentBlockNumberFromLocalDB() {
    const blockData = await CurrentBlock.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.blockNumber) || null;
}
// Function to update the current block number
export async function updateCurrentBlockNumber(blockNumber) {
    const [currentBlock, created] = await CurrentBlock.findOrCreate({ where: {}, defaults: { blockNumber: blockNumber } });
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
        console.log("Failed to fetch current blockNumber.");
    }
}
export async function subscribeToNewBlocks() {
    await init();
    const web3 = getWeb3WsProvider();
    // Subscribe to new block headers
    web3.eth
        .subscribe("newBlockHeaders", async (error, blockHeader) => {
        if (error) {
            console.error(`Error subscribing to new block headers: ${error}`);
            return;
        }
        if (blockHeader.number !== null) {
            await updateCurrentBlockNumber(blockHeader.number); // updating the latest block in the db
            const timestamp = await getBlockTimeStamp(blockHeader.number); // fetching the timestamp of the new block
            await writeBlock(blockHeader.number, timestamp); // writing the timestamp to db
            eventEmitter.emit("new block spotted", blockHeader.number); // emitting new block event for live-parser
        }
    })
        .on("error", console.error); // Log errors
}
//# sourceMappingURL=CurrentBlock.js.map