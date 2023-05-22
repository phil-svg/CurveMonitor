import { transactionExists } from "./ParsingHelper.js";
export async function parseAddLiquidity(event, BLOCK_UNIXTIME, POOL_COINS) {
    if (await transactionExists(event.eventId))
        return;
    if (!POOL_COINS)
        return;
}
//# sourceMappingURL=ParseAddLiquidity.js.map