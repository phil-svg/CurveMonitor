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
import { updateTransactionsDetails } from "./utils/postgresTables/TransactionsDetails.js";
import { updateAddressCounts } from "./utils/postgresTables/CalledAddressCounts.js";
import { eventFlags } from "./utils/api/utils/EventFlags.js";
import { updateSandwichDetection } from "./utils/postgresTables/mevDetection/sandwich/SandwichDetection.js";
import { updateTxTraces } from "./utils/postgresTables/TransactionTraces.js";
import { updateReceipts } from "./utils/postgresTables/Receipts.js";
import { updateContractCreations } from "./utils/postgresTables/ContractCreations.js";
export async function initDatabase() {
    try {
        await db.sync();
        console.log("[✓] Database synced successfully.\n");
    }
    catch (err) {
        console.error("Error syncing database:", err);
    }
}
await initDatabase();
// await updateAtomicArbDetection(); // it finally works!
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
    eventFlags.canEmitGeneralTx = true;
    eventFlags.canEmitAtomicArb = true;
    await updateBlockTimestamps();
    await updateContractCreations();
    await parseEvents();
    await updateTransactionsDetails();
    await updateSandwichDetection();
    eventFlags.canEmitSandwich = true;
    await updateReceipts();
    await updateTxTraces();
    await updateAddressCounts();
    // await updateTokenDollarValues(); // muted until useful
    // await updateAtomicArbDetection();
    await updateLabels();
    // todo
    console.log(`\n[✓] Everything finished syncing successfully.`);
    // process.exit();
}
await main();
//# sourceMappingURL=App.js.map