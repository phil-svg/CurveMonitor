console.clear();

import { db } from "./config/Database.js";
import { loadAddressProvider } from "./utils/AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateBlockTimestamps } from "./utils/postgresTables/Blocks.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
import { updateMevDetection } from "./utils/postgresTables/mevDetection/MevDetection.js";
import { updateLabels } from "./utils/postgresTables/Labels.js";
import { subscribeToNewBlocks } from "./utils/postgresTables/CurrentBlock.js";
import { preparingLiveModeForRawEvents } from "./utils/goingLive/RawTxLogs.js";

async function initDatabase() {
  try {
    await db.sync();
    console.log("[✓] Database synced successfully.");
  } catch (err) {
    console.error("Error syncing database:", err);
  }
}

await initDatabase();
await loadAddressProvider();
await updatePools();
await updateCoinTable();
await updatePoolAbis();
await subscribeToNewBlocks();
// await updateInitialPoolParams(); // muted until useful
// await updatePoolParamsEvents(); // muted until useful

await preparingLiveModeForRawEvents();
await updateRawLogs(); // takes 3:30.627 (m:ss.mmm) to run
await updateBlockTimestamps();

await parseEvents();
// await updateTokenDollarValues(); // muted until useful
await updateMevDetection();
await updateLabels();

// todo

// process.exit();
