import { getCoinsInBatchesByPools } from "../readFunctions/Pools.js";
import { fetchEventsForBlockNumberRange, fetchDistinctBlockNumbers, countRawTxLogs, } from "../readFunctions/RawLogs.js";
import { parseAddLiquidity } from "./ParseAddLiquidity.js";
import { parseRemoveLiquidity } from "./ParseRemoveLiquidity.js";
import { parseRemoveLiquidityImbalance } from "./ParseRemoveLiquidityImbalance.js";
import { parseRemoveLiquidityOne } from "./ParseRemoveLiquidityOne.js";
import { parseTokenExchange } from "./ParseTokenExchange.js";
import { parseTokenExchangeUnderlying } from "./ParseTokenExchangeUnderlying.js";
import { displayProgressBar, updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
import { getTimestampsByBlockNumbers } from "../readFunctions/Blocks.js";
async function sortAndProcess(EVENT, BLOCK_UNIXTIME, POOL_COINS) {
    switch (EVENT.event) {
        case "RemoveLiquidity":
            await parseRemoveLiquidity(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
        case "AddLiquidity":
            await parseAddLiquidity(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
        case "RemoveLiquidityOne":
            await parseRemoveLiquidityOne(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
        case "TokenExchange":
            await parseTokenExchange(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
        case "TokenExchangeUnderlying":
            await parseTokenExchangeUnderlying(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
        case "RemoveLiquidityImbalance":
            await parseRemoveLiquidityImbalance(EVENT, BLOCK_UNIXTIME, POOL_COINS);
            break;
    }
}
async function parseEventsMain() {
    const BATCH_SIZE = 1000;
    const blockNumbers = await fetchDistinctBlockNumbers();
    const AMOUNT_OF_EVENTS_STORED = await countRawTxLogs();
    let parsedCounter = 0;
    console.time();
    for (let i = 0; i <= blockNumbers.length; i += BATCH_SIZE) {
        const startBlock = blockNumbers[i];
        const endBlock = blockNumbers[Math.min(i + BATCH_SIZE, blockNumbers.length - 1)];
        const EVENTS = await fetchEventsForBlockNumberRange(startBlock, endBlock);
        // Get block timestamps
        const eventBlockNumbers = EVENTS.flatMap((event) => (event.blockNumber !== undefined ? [event.blockNumber] : []));
        const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbers(eventBlockNumbers);
        // Get pool coins
        const POOL_COINS = await getCoinsInBatchesByPools(EVENTS.flatMap((event) => (event.pool_id !== undefined ? [event.pool_id] : [])));
        for (const EVENT of EVENTS) {
            if (EVENT.blockNumber === undefined || EVENT.pool_id === undefined)
                continue;
            await sortAndProcess(EVENT, BLOCK_UNIXTIMES[EVENT.blockNumber], POOL_COINS[EVENT.pool_id]);
            parsedCounter++;
            displayProgressBar("Processing Events:", parsedCounter, AMOUNT_OF_EVENTS_STORED);
        }
    }
    console.timeEnd();
}
export async function parseEvents() {
    // console.log(await countEvents());
    await parseEventsMain();
    updateConsoleOutput("[✓] Events parsed successfully.\n");
}
//# sourceMappingURL=ParseTx.js.map