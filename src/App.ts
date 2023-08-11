console.clear();

import { db } from "./config/Database.js";
import { loadAddressProvider } from "./utils/AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateBlockTimestamps } from "./utils/postgresTables/Blocks.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
import { updateLabels } from "./utils/postgresTables/Labels.js";
import { subscribeToNewBlocks } from "./utils/postgresTables/CurrentBlock.js";
import { preparingLiveModeForRawEvents } from "./utils/goingLive/RawTxLogsLive.js";
import { startAPI } from "./utils/api/Server.js";
import { startTestClient } from "./Client.js";
import { updateTransactionsDetails } from "./utils/postgresTables/TransactionsDetails.js";
import { updateAddressCounts } from "./utils/postgresTables/CalledAddressCounts.js";
import { eventFlags } from "./utils/api/utils/EventFlags.js";
import { updateSandwichDetection } from "./utils/postgresTables/mevDetection/Sandwich/SandwichDetection.js";
import { updateAtomicArbDetection } from "./utils/postgresTables/mevDetection/Atomic/atomicArb.js";
import { updateTxTraces } from "./utils/postgresTables/TransactionTraces.js";
import { updateConsoleOutput } from "./utils/helperFunctions/QualityOfLifeStuff.js";
import { updateReceipts } from "./utils/postgresTables/Receipts.js";
import { updateContractCreations } from "./utils/postgresTables/ContractCreations.js";

export async function initDatabase() {
  try {
    await db.sync();
    console.log("[✓] Database synced successfully.");
  } catch (err) {
    console.error("Error syncing database:", err);
  }
}

await initDatabase();

startAPI();
// await startTestClient();

async function main() {
  await loadAddressProvider();
  await updatePools();
  await updateCoinTable();
  await updatePoolAbis();
  await subscribeToNewBlocks();

  // await updateInitialPoolParams(); // muted until useful
  // await updatePoolParamsEvents(); // muted until useful

  await preparingLiveModeForRawEvents();
  await updateRawLogs();
  await updateBlockTimestamps();
  // await updateContractCreations();
  await parseEvents();
  // await updateReceipts();
  await updateTransactionsDetails();
  // await updateTxTraces();
  await updateAddressCounts();

  // await updateTokenDollarValues(); // muted until useful

  await updateSandwichDetection();
  // await updateAtomicArbDetection();
  // await updateLabels();

  eventFlags.canEmitSandwich = true;
  eventFlags.canEmitGeneralTx = true;

  // todo

  console.log(`[✓] Everything finished syncing successfully.`);

  // process.exit();
}

await main();
