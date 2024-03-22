import { Blocks } from "../../models/Blocks.js";
import { fetchAllDistinctBlockNumbers } from "../postgresTables/readFunctions/RawLogs.js";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { fetchBlockNumbers } from "../postgresTables/readFunctions/Blocks.js";
import { getBlockTimestamps } from "../subgraph/Blocktimestamps.js";

export async function writeBlock(block_number: number, timestamp: number): Promise<void> {
  await Blocks.upsert({ block_number, timestamp });
}

export async function writeBlocks(blocks: { block_number: number; timestamp: number }[]): Promise<void> {
  const uniqueBlocks = Array.from(new Map(blocks.map((item) => [item["block_number"], item])).values());
  await Blocks.bulkCreate(uniqueBlocks, {
    updateOnDuplicate: ["timestamp"],
  });
}

async function main() {
  const storedBlockNumbers = await fetchBlockNumbers();
  const allBlockNumbers = await fetchAllDistinctBlockNumbers();
  const storedBlockNumbersSet = new Set(storedBlockNumbers);
  const BLOCK_NUMBERS = allBlockNumbers.filter((blockNumber) => !storedBlockNumbersSet.has(blockNumber));

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

export async function updateBlockTimestamps(): Promise<void> {
  await main();
  updateConsoleOutput("[✓] Timestamps synced successfully.\n");
}
