import { getAllPoolAddresses, getIdByAddress } from "./readFunctions/Pools.js";
import { getContractByAddress } from "../helperFunctions/Web3.js";
import { getPastEvents } from "../web3Calls/generic.js";
import { RawTxLogs } from "../../models/RawTxLogs.js";
import { updateConsoleOutput, displayProgressBar } from "../helperFunctions/QualityOfLifeStuff.js";
import { EventObject } from "../Interfaces.js";
import { readScannedBlockRangesRawLogs, updateScannedBlocksRawLogs } from "./readFunctions/BlockScanningData.js";

export async function storeEvent(event: EventObject, poolId: number): Promise<void> {
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
  } catch (error) {
    if ((error as Error).name !== "SequelizeUniqueConstraintError") {
      throw error;
    }
  }
}

async function processPastEvents(
  pastEvents: EventObject[],
  poolId: number,
  poolAddress: string,
  fromBlock: number,
  toBlock: number,
  currentToBlock: number
): Promise<{ newFromBlock: number; newToBlock: number }> {
  const progressPercentage = ((currentToBlock - fromBlock) / (toBlock - fromBlock)) * 100;
  const message = `Fetching Raw Logs for: ${poolAddress} ${progressPercentage.toFixed(0)}%`;
  updateConsoleOutput(message, 1);

  for (const event of pastEvents) {
    await storeEvent(event, poolId);
  }

  return {
    newFromBlock: currentToBlock,
    newToBlock: toBlock,
  };
}

async function processAddress(poolAddress: string, fromBlock: number, toBlock: number): Promise<void> {
  const POOL_ID = await getIdByAddress(poolAddress);
  if (!POOL_ID) return;

  const CONTRACT = await getContractByAddress(poolAddress);
  if (!CONTRACT) return;

  let currentFromBlock = fromBlock;
  let currentToBlock = toBlock;

  while (currentFromBlock < currentToBlock) {
    const PAST_EVENTS = await getPastEvents(CONTRACT, "allEvents", currentFromBlock, currentToBlock);

    if (PAST_EVENTS === null) {
      console.error("Invalid block range");
      return;
    } else if ("start" in PAST_EVENTS) {
      // If the response contains a suggested block range, update the currentToBlock with the suggested end block number.
      currentToBlock = PAST_EVENTS.end;
    } else if (Array.isArray(PAST_EVENTS)) {
      const { newFromBlock, newToBlock } = await processPastEvents(PAST_EVENTS as EventObject[], POOL_ID, poolAddress, fromBlock, toBlock, currentToBlock);
      currentFromBlock = newFromBlock;
      currentToBlock = newToBlock;
    }
  }
}

async function processAllAddressesSequentially(addresses: string[]): Promise<void> {
  // global scan-range
  let fromBlockScanRange = 17145330;
  let toBlockScanRange = 17380136;

  let storedBlockRangesData = await readScannedBlockRangesRawLogs();

  let storedBlockRanges: number[][] = storedBlockRangesData === "new table" ? [] : storedBlockRangesData;

  // Sort the block ranges
  const sortedBlockRanges = storedBlockRanges.sort((a, b) => a[0] - b[0]);

  // Get the smallest and largest scanned block numbers
  const smallestBlockNumberStored = sortedBlockRanges.length > 0 ? sortedBlockRanges[0][0] : null;
  const largestBlockNumberStored = sortedBlockRanges.length > 0 ? sortedBlockRanges[sortedBlockRanges.length - 1][1] : null;

  // Only process the lower missing end if the smallest block number is larger than the fromBlockScanRange
  if (smallestBlockNumberStored === null || smallestBlockNumberStored > fromBlockScanRange) {
    for (let i = 0; i < addresses.length; i++) {
      displayProgressBar("Processing Pools:", i + 1, addresses.length);
      await processAddress(addresses[i], fromBlockScanRange, smallestBlockNumberStored ? smallestBlockNumberStored - 1 : toBlockScanRange); // Subtract 1 to avoid overlap
    }
    // When processing is done, update the scanned block ranges
    sortedBlockRanges.unshift([fromBlockScanRange, smallestBlockNumberStored ? smallestBlockNumberStored - 1 : toBlockScanRange]);
  }

  // Only process the higher missing end if the largest block number is smaller than the toBlockScanRange
  if (largestBlockNumberStored === null || largestBlockNumberStored < toBlockScanRange) {
    for (let i = 0; i < addresses.length; i++) {
      displayProgressBar("Processing Pools:", i + 1, addresses.length);
      await processAddress(addresses[i], largestBlockNumberStored ? largestBlockNumberStored + 1 : fromBlockScanRange, toBlockScanRange); // Add 1 to avoid overlap
    }
    // When processing is done, update the scanned block ranges
    sortedBlockRanges.push([largestBlockNumberStored ? largestBlockNumberStored + 1 : fromBlockScanRange, toBlockScanRange]);
  }

  if (storedBlockRangesData === "new table" || smallestBlockNumberStored !== null || largestBlockNumberStored !== null) {
    await updateScannedBlocksRawLogs(sortedBlockRanges);
  }
}

export async function updateRawLogs(): Promise<void> {
  const ALL_POOL_ADDRESSES = await getAllPoolAddresses();

  try {
    await processAllAddressesSequentially(ALL_POOL_ADDRESSES);
    updateConsoleOutput("[✓] Raw Logs updated successfully.\n");
  } catch (error) {
    console.error("Error processing addresses:", error);
  }
}
