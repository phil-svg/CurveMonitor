import { Blocks } from "../../models/Blocks.js";
import { fetchAllDistinctBlockNumbers, fetchDistinctBlockNumbers } from "../postgresTables/readFunctions/RawLogs.js";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { fetchBlockNumbers } from "../postgresTables/readFunctions/Blocks.js";
import { getBlockTimestamps } from "../subgraph/Blocktimestamps.js";
export async function writeBlock(block_number, timestamp) {
    const block = await Blocks.findOne({ where: { block_number } });
    if (block) {
        await block.update({ timestamp });
    }
    else {
        await Blocks.create({ block_number, timestamp });
    }
}
export async function writeBlocks(blocks) {
    await Blocks.bulkCreate(blocks, {
        updateOnDuplicate: ["timestamp"],
    });
}
async function main() {
    const NUM_OF_BLOCKS = (await fetchDistinctBlockNumbers()).length;
    const storedBlockNumbers = await fetchBlockNumbers();
    const allBlockNumbers = await fetchAllDistinctBlockNumbers();
    const BLOCK_NUMBERS = allBlockNumbers.filter((blockNumber) => !storedBlockNumbers.includes(blockNumber));
    // Fetch the block timestamps from The Graph
    const blocks = await getBlockTimestamps(BLOCK_NUMBERS);
    // Prepare the data for bulk insertion
    const blocksForInsertion = blocks.map((block) => ({
        block_number: parseInt(block.number),
        timestamp: parseInt(block.timestamp),
    }));
    // Write the blocks to the Blocks table
    await writeBlocks(blocksForInsertion);
}
export async function updateBlockTimestamps() {
    await main();
    updateConsoleOutput("[✓] Timestamps synced successfully.\n");
}
//# sourceMappingURL=Blocks.js.map