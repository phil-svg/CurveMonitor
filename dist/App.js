console.clear();
import { db } from "./config/Database.js";
import { startTestClient } from "./Client.js";
export async function initDatabase() {
    try {
        await db.sync();
        console.log("[✓] Database synced successfully.");
    }
    catch (err) {
        console.error("Error syncing database:", err);
    }
}
await initDatabase();
//startAPI();
await startTestClient();
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
// await updateTransactionsCalls();
// await updateAddressCounts();
// await updateTokenDollarValues(); // muted until useful
// await updateMevDetection();
// await updateLabels();
// todo
// process.exit();
//# sourceMappingURL=App.js.map