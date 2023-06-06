console.clear();
import { db } from "./config/Database.js";
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
// await updateMevDetection();
// await updateLabels();
// todo
process.exit();
//# sourceMappingURL=App.js.map