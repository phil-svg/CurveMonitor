console.clear();
import { db } from "./config/Database.js";
import { updateMevDetection } from "./utils/postgresTables/mevDetection/MevDetection.js";
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
// await updateRawLogs();
// await updateBlockTimestamps();
// await parseEvents();
// await updateTokenDollarValues();
await updateMevDetection();
// todo
process.exit();
//# sourceMappingURL=App.js.map