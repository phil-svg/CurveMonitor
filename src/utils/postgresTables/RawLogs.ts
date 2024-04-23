import {
  getAddressesByPoolIds,
  getAllPoolIds,
  getIdByAddress,
  getRelevantPoolIdsForFastMode,
} from './readFunctions/Pools.js';
import { getContractByAddress } from '../helperFunctions/Web3.js';
import { getPastEvents } from '../web3Calls/generic.js';
import { RawTxLogs } from '../../models/RawTxLogs.js';
import { updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { EventObject } from '../Interfaces.js';
import { updateRawLogsFromBlock, updateRawLogsToBlock } from './readFunctions/BlockScanningData.js';
import { getCurrentBlockNumberFromLocalDB } from './CurrentBlock.js';
import eventEmitter from '../goingLive/EventEmitter.js';
import { retry } from '../helperFunctions/Web3Retry.js';
import { getHighestBlockNumberForPool } from './readFunctions/RawLogs.js';
import EventEmitter from '../goingLive/EventEmitter.js';

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

async function processPastEvents(
  pastEvents: EventObject[],
  poolId: number,
  toBlock: number,
  currentToBlock: number
): Promise<{ newFromBlock: number; newToBlock: number }> {
  for (const event of pastEvents) {
    await storeEvent(event, poolId);
  }

  return {
    newFromBlock: currentToBlock,
    newToBlock: toBlock,
  };
}

export async function processAddress(poolAddress: string, fromBlock: number, toBlock: number): Promise<void> {
  const POOL_ID = await getIdByAddress(poolAddress);
  if (!POOL_ID) return;

  const CONTRACT = await getContractByAddress(poolAddress);
  if (!CONTRACT) return;

  let currentFromBlock = fromBlock;
  let currentToBlock = toBlock;

  while (currentFromBlock < currentToBlock) {
    const PAST_EVENTS = await retry(() => getPastEvents(CONTRACT, 'allEvents', currentFromBlock, currentToBlock));

    if (PAST_EVENTS === null) {
      console.error('Invalid block range');
      return;
    } else if ('start' in PAST_EVENTS) {
      currentToBlock = PAST_EVENTS.end;
    } else if (Array.isArray(PAST_EVENTS)) {
      const { newFromBlock, newToBlock } = await processPastEvents(
        PAST_EVENTS as EventObject[],
        POOL_ID,
        toBlock,
        currentToBlock
      );
      currentFromBlock = newFromBlock;
      currentToBlock = newToBlock;
    } else {
      console.log('Err in processing Address.');
    }
  }
}

async function processBlocksUntilCurrent(address: string, fromBlock: number) {
  while (true) {
    let currentBlockNumber = await getCurrentBlockNumberFromLocalDB();
    if (currentBlockNumber === null) {
      console.error('Failed to fetch current block number');
      return;
    }

    if (fromBlock < currentBlockNumber) {
      await processAddress(address, fromBlock + 1, currentBlockNumber);
      fromBlock = currentBlockNumber;
    }

    let updatedBlockNumber = await getCurrentBlockNumberFromLocalDB();
    if (updatedBlockNumber === null || updatedBlockNumber !== currentBlockNumber) {
      continue;
    } else {
      eventEmitter.emit('ready for subscription', address);
      return;
    }
  }
}

// export const dbInceptionBlock = 17307083;
export const dbInceptionBlock = 9554040;

export async function processAllAddressesSequentially(): Promise<void> {
  const poolIdsFull = await getAllPoolIds();
  console.log('Curve.fi has', poolIdsFull.length, 'pools.');
  const poolIdsWithoutVoided = await getRelevantPoolIdsForFastMode();

  const poolIds = poolIdsWithoutVoided;

  const poolAddresses = await getAddressesByPoolIds(poolIds); // insert poolIdsFull here to be 100%
  let nowBlock = await getCurrentBlockNumberFromLocalDB();

  // let totalTimeTaken = 0;
  console.log('Fetching Raw Logs and Subscribing');
  for (let i = 0; i < poolAddresses.length; i++) {
    if (i % 50 === 0) {
      console.log(i, '/', poolAddresses.length - 1);
    }

    // muting annoying console errors from these pools since they are unferified on etherscan (and dont have traffic)
    const addressesToIgnore = [
      '0x037164C912f9733A0973B18EE339FBeF66cfd2C2',
      '0x38AB39c82BE45f660AFa4A74E85dAd4b4aDd0492',
      '0x3921e2cb3Ac3bC009Fa4ec5Ea1ee0bc7FA4Be4C1',
      '0x0816BC9CED716008c88BB8940C297E9c9167755e',
      '0xAC4Abe9bD07F0ea3b3078880A73f5b3BC4B396e7',
      '0x1a5C82B77cE33Cf5ce87efE5eCdb33f7591B35aa',
    ].map((address) => address.toLowerCase());
    if (addressesToIgnore.includes(poolAddresses[i].toLowerCase())) continue;

    let poolId = await getIdByAddress(poolAddresses[i]);
    let largestBlockNumberStored = await getHighestBlockNumberForPool(poolId!);
    if (!largestBlockNumberStored) largestBlockNumberStored = dbInceptionBlock;
    await processBlocksUntilCurrent(poolAddresses[i], largestBlockNumberStored);
    // const end = new Date().getTime();
    // totalTimeTaken += end - start;

    // logProgress("Fetching Raw Logs and Subscribing", 25, i, totalTimeTaken, poolAddresses.length - 1);
  }

  await updateRawLogsFromBlock(dbInceptionBlock);
  if (nowBlock) await updateRawLogsToBlock(nowBlock);
}

export async function updateRawLogsForLiveMode(): Promise<void> {
  try {
    await processAllAddressesSequentially();
    updateConsoleOutput('[✓] Raw Logs updated successfully.\n');
  } catch (error) {
    console.error('Error processing addresses:', error);
  }
  EventEmitter.on('dead websocket connection', async () => {
    return;
  });
}

export async function updateRawLogs(): Promise<void> {
  // runs every 10th run a full fetch, to make sure we are not leaving any ressurrected pools behind.
  // const randomNumber = Math.floor(Math.random() * 10);
  // if (randomNumber !== 0) return;
  const allPoolIds = await getAllPoolIds();

  const poolAddresses = await getAddressesByPoolIds(allPoolIds); // insert poolIdsFull here to be 100%

  // let totalTimeTaken = 0;
  console.log('Fetching Raw Logs full Fetch (all Pools)');
  for (let i = 0; i < poolAddresses.length; i++) {
    if (i % 50 === 0) {
      console.log(i, '/', poolAddresses.length - 1);
    }

    // muting console errors from these pools since they are unferified on etherscan (and dont have traffic)
    const addressesToIgnore = [
      '0x037164C912f9733A0973B18EE339FBeF66cfd2C2',
      '0x38AB39c82BE45f660AFa4A74E85dAd4b4aDd0492',
      '0x3921e2cb3Ac3bC009Fa4ec5Ea1ee0bc7FA4Be4C1',
      '0x0816BC9CED716008c88BB8940C297E9c9167755e',
      '0xAC4Abe9bD07F0ea3b3078880A73f5b3BC4B396e7',
      '0x1a5C82B77cE33Cf5ce87efE5eCdb33f7591B35aa',
    ].map((address) => address.toLowerCase());
    if (addressesToIgnore.includes(poolAddresses[i].toLowerCase())) continue;

    let poolId = await getIdByAddress(poolAddresses[i]);
    let largestBlockNumberStored = await getHighestBlockNumberForPool(poolId!);
    if (!largestBlockNumberStored) largestBlockNumberStored = dbInceptionBlock;
    await processBlocksUntilCurrent(poolAddresses[i], largestBlockNumberStored);
  }
}
