console.clear();
import { db } from "./config/Database.js";
import { startAPI } from "./utils/api/StartAPI.js";
import { startTestClient } from "./utils/api/Client.js";
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
// await subscribeToNewBlocks();
// await updateInitialPoolParams(); // muted until useful
// await updatePoolParamsEvents(); // muted until useful
// await preparingLiveModeForRawEvents();
// await updateRawLogs();
// await updateBlockTimestamps();
// await parseEvents();
// await updateTokenDollarValues(); // muted until useful
// await updateMevDetection();
// await updateLabels();
await startAPI();
await new Promise((resolve) => setTimeout(resolve, 2000));
startTestClient();
// todo
// process.exit();
//# sourceMappingURL=App.js.map