import { Blocks } from "../../../models/Blocks.js";
export async function fetchBlockNumbers() {
    const blocks = await Blocks.findAll({
        attributes: ["block_number"],
    });
    return blocks.map((block) => block.block_number);
}
export async function getTimestampByBlockNumber(blockNumber) {
    const block = await Blocks.findOne({ where: { block_number: blockNumber } });
    return block ? block.timestamp : null;
}
export async function getTimestampsByBlockNumbersFromLocalDatabase(blockNumbers) {
    // Find blocks with the specified block numbers
    const blocks = await Blocks.findAll({ where: { block_number: blockNumbers } });
    // Create an object that maps block numbers to timestamps
    const blockNumberToTimestamp = {};
    blocks.forEach((block) => (blockNumberToTimestamp[block.block_number] = block.timestamp));
    // For any block numbers that were not found, map them to null
    blockNumbers.forEach((blockNumber) => {
        if (!(blockNumber in blockNumberToTimestamp)) {
            blockNumberToTimestamp[blockNumber] = null;
        }
    });
    return blockNumberToTimestamp;
}
//# sourceMappingURL=Blocks.js.map