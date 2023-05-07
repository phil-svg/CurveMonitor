import { getAllPoolIds, getAllPoolAddresses, getIdByAddress } from './readFunctions/Pools.js';
import { getContractByAddress } from '../helperFunctions/Web3.js';
import { getPastEvents } from '../web3Calls/generic.js';
import { getHighestStoredBlockForPoolId } from './readFunctions/RawLogs.js';
import { RawTxLogs } from '../../models/RawTxLogs.js';
import { updateConsoleOutput, displayProgressBar } from '../helperFunctions/QualityOfLifeStuff.js'
import { EventObject } from '../types.js';

export async function storeEvent(event: EventObject, poolId: number): Promise<void> {
  const {
    address,
    blockHash,
    blockNumber,
    logIndex,
    removed,
    transactionHash,
    transactionIndex,
    id,
    returnValues,
    event: eventName,
    signature,
    raw,
  } = event;

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
    if ((error as Error).name !== 'SequelizeUniqueConstraintError') {
      throw error;
    }
  }
}

async function processPastEvents(pastEvents: EventObject[], poolId: number, poolAddress: string, fromBlock: number, toBlock: number, currentToBlock: number): Promise<{ newFromBlock: number; newToBlock: number }> {
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

async function processAddress(poolAddress: string): Promise<void> {

  const POOL_ID = await getIdByAddress(poolAddress);
  if (!POOL_ID) return;

  const CONTRACT = await getContractByAddress(poolAddress);
  if (!CONTRACT) return;

  // ~ 8 days 17115135
  // ~ 24 days 17007751
  // ~ 62 days 16740930
  // from Alchemy API suggested "to": 16800767
  // now 17180318

  const FROM_BLOCK = 17115135;
  const TO_BLOCK = 17180318;

  let currentFromBlock = FROM_BLOCK;
  let currentToBlock = TO_BLOCK;

  while (currentFromBlock < currentToBlock) {
    const PAST_EVENTS = await getPastEvents(CONTRACT, "allEvents", currentFromBlock, currentToBlock);

    if (PAST_EVENTS === null) {
      console.error("Invalid block range");
      return;
    } else if ('start' in PAST_EVENTS) {
      // If the response contains a suggested block range, update the currentToBlock with the suggested end block number.
      currentToBlock = PAST_EVENTS.end;
    } else if (Array.isArray(PAST_EVENTS)) {
      const { newFromBlock, newToBlock } = await processPastEvents(PAST_EVENTS as EventObject[], POOL_ID, poolAddress, FROM_BLOCK, TO_BLOCK, currentToBlock);
      currentFromBlock = newFromBlock;
      currentToBlock = newToBlock;
    }
  }
}

async function processAllAddressesSequentially(addresses: string[]): Promise<void> {
  for (let i = 0; i < addresses.length; i++) {
    displayProgressBar(i + 1, addresses.length);
    await processAddress(addresses[i]);
  }
}

export async function updateRawLogs(): Promise<void> {
  const ALL_POOL_ADDRESSES = await getAllPoolAddresses();

  try {
    await processAllAddressesSequentially(ALL_POOL_ADDRESSES);
    updateConsoleOutput('[✓] Raw Logs updated successfully.\n');
  } catch (error) {
    console.error('Error processing addresses:', error);
  }
}