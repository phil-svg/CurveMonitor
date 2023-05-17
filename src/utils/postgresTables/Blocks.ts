import { Blocks } from "../../models/Blocks.js";
import { fetchDistinctBlockNumbers, fetchDistinctBlockNumbersInBatch, countRawTxLogs, fetchEventsForBlockNumberRange } from "../postgresTables/readFunctions/RawLogs.js";
import { displayProgressBar, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { fetchBlockNumbers } from "../postgresTables/readFunctions/Blocks.js";
import { getBlockTimestamps } from "../subgraph/Blocktimestamps.js";

async function writeBlocks(blocks: { block_number: number; timestamp: number }[]): Promise<void> {
  await Blocks.bulkCreate(blocks);
}

async function main() {
  const NUM_OF_BLOCKS = (await fetchDistinctBlockNumbers()).length;
  const BATCH_SIZE = 1000;
  let offset = 0;
  let blockNumbersBatch = [];
  let parsedCounter = 0;
  let storedBlockNumbers = await fetchBlockNumbers();

  let writeBlocksPromises = [];

  do {
    blockNumbersBatch = await fetchDistinctBlockNumbersInBatch(offset, BATCH_SIZE);
    const BLOCK_NUMBERS = blockNumbersBatch.filter((blockNumber) => !storedBlockNumbers.includes(blockNumber));

    // Fetch the block timestamps from The Graph
    const blocks = await getBlockTimestamps(BLOCK_NUMBERS);

    // Prepare the data for bulk insertion
    const blocksForInsertion = blocks.map((block) => ({
      block_number: parseInt(block.number),
      timestamp: parseInt(block.timestamp),
    }));

    // Write the blocks to the Blocks table
    writeBlocksPromises.push(writeBlocks(blocksForInsertion));

    offset += BATCH_SIZE;
    parsedCounter += BLOCK_NUMBERS.length;
    displayProgressBar(`Solving Block-Timestamps`, parsedCounter, NUM_OF_BLOCKS);

    // If BATCH_SIZE promises have been accumulated or it's the last iteration
    if (writeBlocksPromises.length === BATCH_SIZE || blockNumbersBatch.length === 0) {
      await Promise.all(writeBlocksPromises);
      writeBlocksPromises = []; // reset the array

      // Update stored block numbers
      storedBlockNumbers = await fetchBlockNumbers();
    }
  } while (blockNumbersBatch.length > 0);
}

export async function updateBlockTimestamps(): Promise<void> {
  await main();
  updateConsoleOutput("[✓] Timestamps synced successfully.\n");
}
