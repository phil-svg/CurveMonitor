console.clear();
import { db } from "./config/Database.js";
import { loadAddressProvider } from "./AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateInitialPoolParams } from "./utils/postgresTables/InitialParams.js";
import { updatePoolParamsEvents } from "./utils/postgresTables/PoolParamsEvents.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
async function initDatabase() {
    try {
        await db.sync();
        console.log("[✓] Database synced successfully.");
    }
    catch (err) {
        console.error("Error syncing database:", err);
    }
}
await initDatabase();
await loadAddressProvider();
await updatePools();
await updateCoinTable();
await updatePoolAbis();
await updateInitialPoolParams();
await updatePoolParamsEvents();
console.log("[✓] Syncing configs complete.");
await updateRawLogs();
// here goes code
// simplified problem: Save raw log for only 3pool for only 1h. in a table
/**
 * needed:
 * function that loops over all pools
 * function that fílters only one pool (3Pool)
 * function that filters only last hour
 * new table to store the events
 * function to write the events to that table
 * function to get events, even tho I think that already exists in this App
 * added folder logic to deal with raw logs
 */
process.exit();
//# sourceMappingURL=App.js.map