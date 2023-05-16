import { getAllPoolIds } from "./readFunctions/Pools.js";
import { fetchPoolEventsInBatches, getEntriesByBlockNumberIndex, countEvents } from "./readFunctions/RawLogs.js";
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
    //
    // brainstorm
    console.log(await countEvents());
    console.log(await getEntriesByBlockNumberIndex(1));
    // console.log(await getEntriesByTransactionHash("0xdf96c2702ced9d79aa484fa9f03b8014010dff34f7d63b938611cdcc725ee75a"));
    //
    // console.log("[✓] Events parsed successfully.");
}
//# sourceMappingURL=ParseTx.js.map