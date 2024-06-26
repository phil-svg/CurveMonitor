import { Blocks } from '../../models/Blocks.js';
import { updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
// import { getBlockTimestamps } from '../subgraph/Blocktimestamps.js';
import { sequelize } from '../../config/Database.js';
import { getBlockTimeStampFromNode } from '../web3Calls/generic.js';
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
export async function updateBlockTimestamps() {
    const blockNumbersToFetch = await getAllBlockNumbersToFetchForTimestamps();
    console.log('updating timestampts for', blockNumbersToFetch.length, 'blocks');
    let counter = 0;
    for (const blockNumber of blockNumbersToFetch) {
        counter++;
        if (counter % 100 === 0) {
            console.log(`Process block unixtimes: ${counter} / ${blockNumbersToFetch.length}`);
        }
        const blockUnixtime = await getBlockTimeStampFromNode(blockNumber);
        if (!blockUnixtime)
            continue;
        await writeBlocks([{ block_number: blockNumber, timestamp: blockUnixtime }]);
    }
    // // Fetch the block timestamps from The Graph
    // const blocks = await getBlockTimestamps(blockNumbersToFetch);
    // // Prepare the data for bulk insertion
    // const blocksForInsertion = blocks.map((block) => ({
    //   block_number: parseInt(block.number),
    //   timestamp: parseInt(block.timestamp),
    // }));
    // // Write the blocks to the Blocks table
    // await writeBlocks(blocksForInsertion);
    updateConsoleOutput('[✓] Timestamps synced successfully.\n');
}
//# sourceMappingURL=Blocks.js.map