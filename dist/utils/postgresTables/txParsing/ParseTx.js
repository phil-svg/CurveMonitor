import { fetchEventsForBlockNumberRange, fetchDistinctBlockNumbers, countRawTxLogs, } from "../readFunctions/RawLogs.js";
import { parseAddLiquidity } from "./ParseAddLiquidity.js";
import { parseRemoveLiquidity } from "./ParseRemoveLiquidity.js";
import { parseRemoveLiquidityImbalance } from "./ParseRemoveLiquidityImbalance.js";
import { parseRemoveLiquidityOne } from "./ParseRemoveLiquidityOne.js";
import { parseTokenExchange } from "./ParseTokenExchange.js";
import { parseTokenExchangeUnderlying } from "./ParseTokenExchangeUnderlying.js";
import { displayProgressBar, updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
async function sortAndProcess(EVENT) {
    switch (EVENT.event) {
        case "RemoveLiquidity":
            await parseRemoveLiquidity(EVENT);
            break;
        case "AddLiquidity":
            await parseAddLiquidity(EVENT);
            break;
        case "RemoveLiquidityOne":
            await parseRemoveLiquidityOne(EVENT);
            break;
        case "TokenExchange":
            await parseTokenExchange(EVENT);
            break;
        case "TokenExchangeUnderlying":
            await parseTokenExchangeUnderlying(EVENT);
            break;
        case "RemoveLiquidityImbalance":
            await parseRemoveLiquidityImbalance(EVENT);
            break;
    }
}
async function parseEventsMain() {
    const BATCH_SIZE = 1000;
    const blockNumbers = await fetchDistinctBlockNumbers();
    const AMOUNT_OF_EVENTS_STORED = await countRawTxLogs();
    let parsedCounter = 0;
    for (let i = 0; i <= blockNumbers.length; i += BATCH_SIZE) {
        const startBlock = blockNumbers[i];
        const endBlock = blockNumbers[Math.min(i + BATCH_SIZE, blockNumbers.length - 1)];
        const EVENTS = await fetchEventsForBlockNumberRange(startBlock, endBlock);
        for (const EVENT of EVENTS) {
            await sortAndProcess(EVENT);
            parsedCounter++;
            displayProgressBar("Processing Events:", parsedCounter, AMOUNT_OF_EVENTS_STORED);
        }
    }
}
export async function parseEvents() {
    // console.log(await countEvents());
    await parseEventsMain();
    updateConsoleOutput("[✓] Events parsed successfully.\n");
}
//# sourceMappingURL=ParseTx.js.map