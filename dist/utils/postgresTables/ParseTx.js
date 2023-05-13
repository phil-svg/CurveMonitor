import { getAllPoolIds } from "./readFunctions/Pools.js";
import { fetchPoolEventsInBatches } from "./readFunctions/RawLogs.js";
async function parseEventsForPoolID(poolId) {
    let offset = 0;
    const BATCH_SIZE = 1000;
    while (true) {
        const events = await fetchPoolEventsInBatches(poolId, offset, BATCH_SIZE);
        if (events.length === 0) {
            break;
        }
        for (const event of events) {
            // process event here
        }
        offset += BATCH_SIZE;
    }
}
export async function parseEvents() {
    const ALL_POOL_IDS = await getAllPoolIds();
    for (const POOL_ID of ALL_POOL_IDS) {
        await parseEventsForPoolID(POOL_ID);
    }
    console.log("[✓] Events parsed successfully.");
}
//# sourceMappingURL=ParseTx.js.map