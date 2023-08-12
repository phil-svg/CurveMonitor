import { Blocks } from "../../models/Blocks.js";
import { fetchAllDistinctBlockNumbers, fetchDistinctBlockNumbers, fetchDistinctBlockNumbersInBatch } from "../postgresTables/readFunctions/RawLogs.js";
import { displayProgressBar, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { fetchBlockNumbers } from "../postgresTables/readFunctions/Blocks.js";
import { getBlockTimestamps } from "../subgraph/Blocktimestamps.js";

export async function writeBlock(block_number: number, timestamp: number): Promise<void> {
  const block = await Blocks.findOne({ where: { block_number } });

  if (block) {
    await block.update({ timestamp });
  } else {
    await Blocks.create({ block_number, timestamp });
  }
}

export async function writeBlocks(blocks: { block_number: number; timestamp: number }[]): Promise<void> {
  await Blocks.bulkCreate(blocks, {
    updateOnDuplicate: ["timestamp"],
  });
}

async function main() {
  console.log(`fetching stored blocknumbers for BlockTimestamps`);
  const storedBlockNumbers = await fetchBlockNumbers();
  console.log(`Found ${storedBlockNumbers.length} stored Blocks`);

  console.log(`fetching allBlockNumbers for BlockTimestamps`);
  const allBlockNumbers = await fetchAllDistinctBlockNumbers();
  console.log(`done collecting allBlockNumbers for BlockTimestamps`);
  const BLOCK_NUMBERS = allBlockNumbers.filter((blockNumber) => !storedBlockNumbers.includes(blockNumber));

  // Fetch the block timestamps from The Graph
  console.log(`Fetching blockTimestamps from the Graph`);
  const blocks = await getBlockTimestamps(BLOCK_NUMBERS);

  // Prepare the data for bulk insertion
  const blocksForInsertion = blocks.map((block) => ({
    block_number: parseInt(block.number),
    timestamp: parseInt(block.timestamp),
  }));

  // Write the blocks to the Blocks table
  await writeBlocks(blocksForInsertion);
}

export async function updateBlockTimestamps(): Promise<void> {
  await main();
  updateConsoleOutput("[✓] Timestamps synced successfully.\n");
}
