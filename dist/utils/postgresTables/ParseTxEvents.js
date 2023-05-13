import { getAllPoolIds } from "./readFunctions/Pools.js";
import { getLowestAndHighestBlockForPoolId } from "./readFunctions/RawLogs.js";
export async function readingTest() {
    console.time();
    const ALL_POOL_IDS = await getAllPoolIds();
    for (const POOL_ID of ALL_POOL_IDS) {
        const BLOCK_RANGE = await getLowestAndHighestBlockForPoolId(POOL_ID);
        if (BLOCK_RANGE !== null) {
            for (let blockNumber = BLOCK_RANGE.lowest; blockNumber <= BLOCK_RANGE.highest; blockNumber++) {
                // console.log(POOL_ID, blockNumber);
            }
        }
    }
    console.timeEnd();
}
//# sourceMappingURL=ParseTxEvents.js.map