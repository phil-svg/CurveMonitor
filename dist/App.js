console.clear();
import { db } from "./config/Database.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
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
// await loadAddressProvider();
// await updatePools();
// await updateCoinTable();
// await updatePoolAbis();
// await updateInitialPoolParams();
// await updatePoolParamsEvents();
// await updateBlockTimestamps();
// await updateRawLogs();
await parseEvents();
//  https://defillama.com/docs/api
// todo
process.exit();
//# sourceMappingURL=App.js.map