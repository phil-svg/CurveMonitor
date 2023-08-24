import { getCoinsInBatchesByPools } from "../readFunctions/Pools.js";
import { fetchEventsForBlockNumberRange, fetchDistinctBlockNumbers, countRawTxLogs } from "../readFunctions/RawLogs.js";
import { parseAddLiquidity } from "./ParseAddLiquidity.js";
import { parseRemoveLiquidity } from "./ParseRemoveLiquidity.js";
import { parseRemoveLiquidityImbalance } from "./ParseRemoveLiquidityImbalance.js";
import { parseRemoveLiquidityOne } from "./ParseRemoveLiquidityOne.js";
import { parseTokenExchange } from "./ParseTokenExchange.js";
import { parseTokenExchangeUnderlying } from "./ParseTokenExchangeUnderlying.js";
import { updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
import { getTimestampsByBlockNumbersFromLocalDatabase } from "../readFunctions/Blocks.js";
import { getEventParsingFromBlock, getEventParsingToBlock, updateEventParsingFromBlock, updateEventParsingToBlock } from "../readFunctions/BlockScanningData.js";
import Bottleneck from "bottleneck";
import { MAX_ETH_GET_TRANSACTION_RECEIPT_REQUESTS_PER_SECOND } from "../../../config/Alchemy.js";
import { getTotalTransactionsCount } from "../readFunctions/Transactions.js";
export async function sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS) {
    const functions = {
        RemoveLiquidity: parseRemoveLiquidity,
        AddLiquidity: parseAddLiquidity,
        TokenExchange: parseTokenExchange,
        RemoveLiquidityImbalance: parseRemoveLiquidityImbalance,
    };
    const tokenExchangeUnderlyingEvents = [];
    const removeLiquidityOneEvents = [];
    const otherEvents = [];
    EVENTS.forEach((EVENT) => {
        if (EVENT.event === "TokenExchangeUnderlying") {
            tokenExchangeUnderlyingEvents.push(EVENT);
        }
        else if (EVENT.event === "RemoveLiquidityOne") {
            removeLiquidityOneEvents.push(EVENT);
        }
        else {
            otherEvents.push(EVENT);
        }
    });
    /** first parses the most basic event types */
    const otherPromises = otherEvents
        .map((EVENT) => {
        const func = functions[EVENT.event];
        if (func) {
            return func(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]);
        }
    })
        .filter(Boolean);
    try {
        await Promise.all(otherPromises);
    }
    catch (error) {
        console.error(error);
    }
    /** then parses RemoveLiquidityOne, can require web3 calls, therefore, solving uniquely for best speed */
    const limiter = new Bottleneck({
        maxConcurrent: 10,
        minTime: 1000 / MAX_ETH_GET_TRANSACTION_RECEIPT_REQUESTS_PER_SECOND,
    });
    // limiter is sensitive, right now stable.
    const removeLiquidityOnePromises = removeLiquidityOneEvents.map((EVENT) => {
        return limiter.schedule(() => parseRemoveLiquidityOne(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]));
    });
    try {
        await Promise.all(removeLiquidityOnePromises);
    }
    catch (error) {
        console.error(error);
    }
    /** lastly parsing underlying exchanges, since we can now include pre-solved events which occured in the same tx. */
    const tokenExchangeUnderlyingPromises = tokenExchangeUnderlyingEvents.map((EVENT) => {
        return parseTokenExchangeUnderlying(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]);
    });
    try {
        await Promise.all(tokenExchangeUnderlyingPromises);
    }
    catch (error) {
        console.error(error);
    }
}
async function parseEventsMain() {
    let eventParsingFromBlock = await getEventParsingFromBlock();
    let eventParsingToBlock = await getEventParsingToBlock();
    const BATCH_SIZE = 1000;
    const blockNumbers = await fetchDistinctBlockNumbers();
    const AMOUNT_OF_EVENTS_STORED = await countRawTxLogs();
    const alreadyParsedAmount = await getTotalTransactionsCount();
    let counter = 0;
    for (let i = 0; i <= blockNumbers.length; i += BATCH_SIZE) {
        const startBlock = blockNumbers[i];
        const endBlock = blockNumbers[Math.min(i + BATCH_SIZE, blockNumbers.length - 1)];
        // If we have parsing bounds, and the current batch of blocks is fully within these bounds, skip this batch.
        if (eventParsingFromBlock && eventParsingToBlock && startBlock >= eventParsingFromBlock && endBlock <= eventParsingToBlock)
            continue;
        const EVENTS = await fetchEventsForBlockNumberRange(startBlock, endBlock);
        // Get block timestamps
        const eventBlockNumbers = EVENTS.flatMap((event) => (event.blockNumber !== undefined ? [event.blockNumber] : []));
        const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbersFromLocalDatabase(eventBlockNumbers);
        // Get pool coins
        const POOL_COINS = await getCoinsInBatchesByPools(EVENTS.flatMap((event) => (event.pool_id !== undefined ? [event.pool_id] : [])));
        await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, POOL_COINS);
        counter += EVENTS.length;
        await updateEventParsingToBlock(startBlock);
        // displayProgressBar("Parsing in progress", counter + 1, AMOUNT_OF_EVENTS_STORED);
        console.log("Parsing in progress", counter + 1, alreadyParsedAmount);
    }
    await updateEventParsingFromBlock(blockNumbers[0]);
    await updateEventParsingToBlock(blockNumbers[blockNumbers.length - 1]);
}
export async function parseEvents() {
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
//# sourceMappingURL=ParseTx.js.map