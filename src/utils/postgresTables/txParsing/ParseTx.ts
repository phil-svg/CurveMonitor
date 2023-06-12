import { getCoinsInBatchesByPools } from "../readFunctions/Pools.js";
import { fetchEventsForBlockNumberRange, fetchDistinctBlockNumbers, countRawTxLogs } from "../readFunctions/RawLogs.js";
import { parseAddLiquidity } from "./ParseAddLiquidity.js";
import { parseRemoveLiquidity } from "./ParseRemoveLiquidity.js";
import { parseRemoveLiquidityImbalance } from "./ParseRemoveLiquidityImbalance.js";
import { parseRemoveLiquidityOne } from "./ParseRemoveLiquidityOne.js";
import { parseTokenExchange } from "./ParseTokenExchange.js";
import { parseTokenExchangeUnderlying } from "./ParseTokenExchangeUnderlying.js";
import { displayProgressBar, updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
import { getTimestampsByBlockNumbers } from "../readFunctions/Blocks.js";
import { readScannedBlockRangesEventParsing, updateScannedBlocksEventParsing } from "../readFunctions/BlockScanningData.js";

async function sortAndProcess(EVENTS: any, BLOCK_UNIXTIMES: any, POOL_COINS: any): Promise<void> {
  const functions = {
    RemoveLiquidity: parseRemoveLiquidity,
    AddLiquidity: parseAddLiquidity,
    RemoveLiquidityOne: parseRemoveLiquidityOne,
    TokenExchange: parseTokenExchange,
    RemoveLiquidityImbalance: parseRemoveLiquidityImbalance,
  };

  const tokenExchangeUnderlyingEvents: any[] = [];
  const otherEvents: any[] = [];

  EVENTS.forEach((EVENT: any) => {
    if (EVENT.event === "TokenExchangeUnderlying") {
      tokenExchangeUnderlyingEvents.push(EVENT);
    } else {
      otherEvents.push(EVENT); // Per batch, making sure that the Events of type 'ExchangeUnderlyings' run last.
    }
  });

  const otherPromises = otherEvents
    .map((EVENT: any) => {
      const func = functions[EVENT.event as keyof typeof functions];
      if (func) {
        return func(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]);
      }
    })
    .filter(Boolean);

  try {
    await Promise.all(otherPromises);
  } catch (error) {
    console.error(error);
  }

  const tokenExchangeUnderlyingPromises = tokenExchangeUnderlyingEvents.map((EVENT: any) => {
    return parseTokenExchangeUnderlying(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]);
  });

  try {
    await Promise.all(tokenExchangeUnderlyingPromises);
  } catch (error) {
    console.error(error);
  }
}

async function parseEventsMain(): Promise<void> {
  const BATCH_SIZE = 1000;
  const blockNumbers = await fetchDistinctBlockNumbers();
  const AMOUNT_OF_EVENTS_STORED = await countRawTxLogs();
  let counter = 0;

  // Read the previously scanned block ranges
  let storedBlockRangesData = await readScannedBlockRangesEventParsing();

  // If the table is new or no ranges were previously stored, process the entire range
  let storedBlockRanges: number[][] = storedBlockRangesData === "new table" ? [] : storedBlockRangesData;

  // Sort the block ranges
  const sortedBlockRanges = storedBlockRanges.sort((a, b) => a[0] - b[0]);

  // Get the smallest and largest scanned block numbers
  const smallestBlockNumberStored = sortedBlockRanges.length > 0 ? sortedBlockRanges[0][0] : null;
  const largestBlockNumberStored = sortedBlockRanges.length > 0 ? sortedBlockRanges[sortedBlockRanges.length - 1][1] : null;

  const startBlock = smallestBlockNumberStored || blockNumbers[0];
  const endBlock = largestBlockNumberStored || blockNumbers[blockNumbers.length - 1];

  for (let i = startBlock; i <= endBlock; i += BATCH_SIZE) {
    // Only process the batch if it was not previously processed
    if (!isBlockInRange([i, Math.min(i + BATCH_SIZE, endBlock)], sortedBlockRanges)) {
      const EVENTS = await fetchEventsForBlockNumberRange(i, Math.min(i + BATCH_SIZE, endBlock));

      // Get block timestamps
      const eventBlockNumbers = EVENTS.flatMap((event) => (event.blockNumber !== undefined ? [event.blockNumber] : []));
      const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbers(eventBlockNumbers);

      // Get pool coins
      const POOL_COINS = await getCoinsInBatchesByPools(EVENTS.flatMap((event) => (event.pool_id !== undefined ? [event.pool_id] : [])));

      await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS);
      counter += EVENTS.length;
      displayProgressBar("Parsing in progress", counter + 1, AMOUNT_OF_EVENTS_STORED);

      // Update the scanned block range in the database
      sortedBlockRanges.push([i, Math.min(i + BATCH_SIZE, endBlock)]);
      await updateScannedBlocksEventParsing(sortedBlockRanges);
    }
  }
}

// Helper function to check if a block range was previously processed
function isBlockInRange(blockRange: number[], storedBlockRanges: number[][]): boolean {
  for (let i = 0; i < storedBlockRanges.length; i++) {
    if (storedBlockRanges[i][0] <= blockRange[0] && storedBlockRanges[i][1] >= blockRange[1]) {
      return true;
    }
  }

  return false;
}

export async function parseEvents(): Promise<void> {
  // console.log(await countEvents());
  await parseEventsMain();
  updateConsoleOutput("[✓] Events parsed successfully.\n");
}

/**
Event Examples

AddLiquidity ** solved **
{
  eventId: 13570,
  pool_id: 592,
  address: '0x7E650c700b0801e717B352E55a582AFd928aa094',
  blockNumber: 17115233,
  transactionHash: '0x89d6a6054ddff6e040c3f56b3e5edfcdc9e89d21ab2e4dbdb123b13355691114',
  transactionIndex: 73,
  logIndex: 171,
  removed: false,
  event: 'AddLiquidity',
  returnValues: {
    provider: '0x5592cB82f5B11A4E42B1275A973E6B712194e239',
    token_amounts: [ '42600000000000000000000', '49815573620404875891389' ],
    fee: '0',
    token_supply: '0'
  }
}

RemoveLiquidityOne ** solved **
{
  eventId: 2012,
  pool_id: 360,
  address: '0xd658A338613198204DCa1143Ac3F01A722b5d94A',
  blockNumber: 17115142,
  transactionHash: '0x82abf58e4cf2bf82a0ffc1478a2f7733c97fb247d8ebae5fad65d08d6502de8a',
  transactionIndex: 72,
  logIndex: 184,
  removed: false,
  event: 'RemoveLiquidityOne',
  returnValues: {
    provider: '0xC6142e98b9187A9F18B171e0f2463A2e581FF8cA',
    token_amount: '81463957051156349422',
    coin_index: '0',
    coin_amount: '159796967792349040810'
  }
}

RemoveLiquidity ** solved **
{
  eventId: 2936,
  pool_id: 45,
  address: '0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2',
  blockNumber: 17115410,
  transactionHash: '0xb38410f0ddc6eb4ecb4b9e4df38a22b17756dc887737dc89917918a2e49e2c92',
  transactionIndex: 41,
  logIndex: 94,
  removed: false,
  event: 'RemoveLiquidity',
  returnValues: {
    provider: '0x5De4EF4879F4fe3bBADF2227D2aC5d0E2D76C895',
    token_amounts: [ '14306241372836033295580', '8627046978' ],
    fees: [ '0', '0' ],
    token_supply: '497911581245115411300288400'
  }
}

TokenExchange ** solved **
{
  eventId: 14820,
  pool_id: 333,
  address: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
  blockNumber: 17115161,
  transactionHash: '0x05a36fbe3b09c21d055b143493d46b6617277584e08e05ab8760229cddfa2f95',
  transactionIndex: 5,
  logIndex: 26,
  removed: false,
  event: 'TokenExchange',
  returnValues: {
    buyer: '0x280027dd00eE0050d3F9d168EFD6B40090009246',
    sold_id: '1',
    tokens_sold: '147309156',
    bought_id: '0',
    tokens_bought: '40130504439'
  }
}

TokenExchangeUnderlying ** solved **
{
  eventId: 13758,
  pool_id: 16,
  address: '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD',
  blockNumber: 17115177,
  transactionHash: '0xb83ae13909ed14fe581c42c63004065c2bcfbc1934a78c976e2895b48bf99189',
  transactionIndex: 17,
  logIndex: 48,
  removed: false,
  event: 'TokenExchangeUnderlying',
  returnValues: {
    buyer: '0xE4000004000bd8006e00720000d27d1FA000d43e',
    sold_id: '3',
    tokens_sold: '35194553349873239621886',
    bought_id: '1',
    tokens_bought: '35242532247'
  }
}

RemoveLiquidityImbalance ** solved **
{
  eventId: 13759,
  pool_id: 16,
  address: '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD',
  blockNumber: 17115216,
  transactionHash: '0xf999ef01296a02c4b4d84b4c29cd1c23d4fb07d7d337c2659015117d55c488b4',
  transactionIndex: 24,
  logIndex: 37,
  removed: false,
  event: 'RemoveLiquidityImbalance',
  returnValues: {
    provider: '0xFCBa3E75865d2d561BE8D220616520c171F12851',
    token_amounts: [ '0', '85733170953', '0', '0' ],
    fees: [
      '1522755960478532550',
      '4173650',
      '1557465',
      '1091769129330742464'
    ],
    invariant: '56782871212835051929526282',
    token_supply: '53360124344959706125839884'
  }
}

*/
