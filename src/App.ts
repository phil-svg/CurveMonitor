console.clear();

import { db } from "./config/Database.js";
import { loadAddressProvider } from "./AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateInitialPoolParams } from "./utils/postgresTables/InitialParams.js";
import { updatePoolParamsEvents } from "./utils/postgresTables/PoolParamsEvents.js";
import { updateBlockTimestamps } from "./utils/postgresTables/Blocks.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
import { updateTokenDollarValues } from "./utils/postgresTables/tokenPrices/Prices.js";

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
// await updateBlockTimestamps();
// await updateRawLogs();
// await parseEvents();
await updateTokenDollarValues();

//  https://defillama.com/docs/api
// todo

// process.exit();
