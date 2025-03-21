import { getVersionBy, getInceptionBlockBy, getAllPoolIds, getAddressById } from './readFunctions/Pools.js';
import { getBlockTimeStampFromNode, getPastEvents, WEB3_HTTP_PROVIDER } from '../web3Calls/generic.js';
import { getAbiBy } from './Abi.js';
import { PoolParamsEvents } from '../../models/PoolParamsEvents.js';
import { retry } from '../helperFunctions/Web3Retry.js';
import { getLatestEventTimestampFromSubgraph } from '../subgraph/DaoSubgraph.js';

async function addPoolParamsEvent(
  pool_id: number,
  log_index: number,
  event_name: string,
  raw_log: string,
  event_block: number,
  event_timestamp: number
): Promise<void> {
  const newPoolParamsEvent = new PoolParamsEvents({
    pool_id,
    log_index,
    event_name,
    raw_log,
    event_block,
    event_timestamp,
  });

  await newPoolParamsEvent.save();
}

async function entryExistsForLogIndex(poolId: number, logIndex: number): Promise<boolean> {
  const entry = await PoolParamsEvents.findOne({
    where: {
      pool_id: poolId,
      log_index: logIndex,
    },
  });

  return entry !== null;
}

async function handleEvent(poolId: number, eventName: string, EVENT: any): Promise<void> {
  const LOG_INDEX = EVENT.logIndex;
  if (await entryExistsForLogIndex(poolId, LOG_INDEX)) return;
  const POOL_ID = poolId;
  const EVENT_NAME = eventName;
  const RAW_LOG = EVENT;
  const EVENT_BLOCK = EVENT.blockNumber;
  const EVENT_TIMESTAMP = await getBlockTimeStampFromNode(EVENT_BLOCK);
  await addPoolParamsEvent(POOL_ID, LOG_INDEX, EVENT_NAME, RAW_LOG, EVENT_BLOCK, EVENT_TIMESTAMP!);
  console.log('saving', POOL_ID, LOG_INDEX);
}

function isEventInABI(abi: any[], eventName: string): boolean {
  return abi.some((entry) => entry.type === 'event' && entry.name === eventName);
}

async function handleVersion(
  poolId: number,
  POOL_ADDRESS: string,
  POOL_ABI: any[],
  CURRENT_BLOCK: number,
  POTENTIAL_EVENTS: string[]
): Promise<void> {
  const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);

  const poolParamsEvent = await PoolParamsEvents.findOne({ where: { pool_id: poolId } });
  const lastBlockChecked = poolParamsEvent?.last_block_checked;

  const startingBlock: number | null =
    lastBlockChecked == null ? await getInceptionBlockBy({ address: POOL_ADDRESS }) : lastBlockChecked;

  for (const EVENT_NAME of POTENTIAL_EVENTS) {
    if (!isEventInABI(POOL_ABI, EVENT_NAME)) continue;
    console.log('checking for', EVENT_NAME);
    const PAST_EVENTS = await retry(() => getPastEvents(CONTRACT, EVENT_NAME, startingBlock, CURRENT_BLOCK));
    if (!PAST_EVENTS) continue;
    if (PAST_EVENTS !== null && Array.isArray(PAST_EVENTS)) {
      for (const EVENT of PAST_EVENTS) {
        await handleEvent(poolId, EVENT_NAME, EVENT);
      }
    }
  }
}

async function updateLastBlockChecked(poolId: number, lastBlockChecked: number): Promise<void> {
  await PoolParamsEvents.update({ last_block_checked: lastBlockChecked }, { where: { pool_id: poolId } });
}

async function solveParamEvents(poolId: number, CURRENT_BLOCK: number): Promise<void> {
  const VERSION = await getVersionBy({ id: poolId });

  const POOL_ADDRESS = await getAddressById(poolId);
  if (!POOL_ADDRESS) return;

  const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
  if (!POOL_ABI) return;

  if (VERSION === 'v1') {
    await handleVersion(poolId, POOL_ADDRESS, POOL_ABI, CURRENT_BLOCK, [
      'NewFee',
      'RampA',
      'StopRampA',
      'NewParameters',
      'CommitNewParameters',
    ]);
  } else if (VERSION === 'v2') {
    await handleVersion(poolId, POOL_ADDRESS, POOL_ABI, CURRENT_BLOCK, ['NewParameters', 'RampAgamma', 'StopRampA']);
  }
  await updateLastBlockChecked(poolId, CURRENT_BLOCK);
}

export async function updatePoolParamsEvents(): Promise<void> {
  const latestEventTimestampFromSubgraph = Number(await getLatestEventTimestampFromSubgraph());

  const LAST_BLOCK_CHECKED = (await PoolParamsEvents.min('last_block_checked')) as number;
  const LAST_UNIXTIME_CHECKED = await getBlockTimeStampFromNode(LAST_BLOCK_CHECKED);
  if (!LAST_UNIXTIME_CHECKED) return;

  // gets triggered if say the last check was Monday, it is now Friday, and Subgraph shows Event for Wednesday.
  if (latestEventTimestampFromSubgraph >= LAST_UNIXTIME_CHECKED) {
    const ALL_POOL_IDS = (await getAllPoolIds()).sort((a, b) => a - b);
    const CURRENT_BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlockNumber();
    let i = 1;
    for (const POOL_ID of ALL_POOL_IDS) {
      console.log(i + '/' + ALL_POOL_IDS.length);
      i++;
      await solveParamEvents(POOL_ID, CURRENT_BLOCK);
    }
  }
  console.log(`[✓] Table: Param | Parameter-Events synced successfully.`);
  console.log('[✓] Syncing configs complete.');
}
