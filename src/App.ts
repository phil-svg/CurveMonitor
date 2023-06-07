console.clear();

import { db } from "./config/Database.js";
import { loadAddressProvider } from "./utils/AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateInitialPoolParams } from "./utils/postgresTables/InitialParams.js";
import { updatePoolParamsEvents } from "./utils/postgresTables/PoolParamsEvents.js";
import { updateBlockTimestamps } from "./utils/postgresTables/Blocks.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
import { updateTokenDollarValues } from "./utils/postgresTables/tokenPrices/Prices.js";
import { updateMevDetection } from "./utils/postgresTables/mevDetection/MevDetection.js";
import { updateLabels } from "./utils/postgresTables/Labels.js";

async function initDatabase() {
  try {
    await db.sync();
    console.log("[✓] Database synced successfully.");
  } catch (err) {
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
await updateLabels();

// todo

process.exit();
