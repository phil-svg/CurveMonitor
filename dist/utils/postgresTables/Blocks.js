import { Blocks } from '../../models/Blocks.js';
import { updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { getBlockTimestamps } from '../subgraph/Blocktimestamps.js';
import { sequelize } from '../../config/Database.js';
export async function writeBlock(block_number, timestamp) {
    await Blocks.upsert({ block_number, timestamp });
}
export async function writeBlocks(blocks) {
    const uniqueBlocks = Array.from(new Map(blocks.map((item) => [item['block_number'], item])).values());
    await Blocks.bulkCreate(uniqueBlocks, {
        updateOnDuplicate: ['timestamp'],
    });
}
export async function getAllBlockNumbersToFetchForTimestamps() {
    const query = `
        SELECT DISTINCT r.block_number
        FROM raw_tx_logs AS r
        LEFT JOIN blocks AS b ON r.block_number = b.block_number
        WHERE b.block_number IS NULL
        ORDER BY r.block_number ASC;
    `;
    const [result] = await sequelize.query(query);
    // Map the result to return an array of block numbers only
    return result.map((row) => row.block_number);
}
async function main() {
    const blockNumbersToFetch = await getAllBlockNumbersToFetchForTimestamps();
    // Fetch the block timestamps from The Graph
    const blocks = await getBlockTimestamps(blockNumbersToFetch);
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
    updateConsoleOutput('[✓] Timestamps synced successfully.\n');
}
//# sourceMappingURL=Blocks.js.map