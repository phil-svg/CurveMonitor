console.clear();
import { db } from "./config/Database.js";
import { loadAddressProvider } from "./utils/AddressProviderEntryPoint.js";
import { updatePools } from "./utils/postgresTables/Pools.js";
import { updateCoinTable } from "./utils/postgresTables/Coins.js";
import { updatePoolAbis } from "./utils/postgresTables/Abi.js";
import { updateBlockTimestamps } from "./utils/postgresTables/Blocks.js";
import { updateRawLogs } from "./utils/postgresTables/RawLogs.js";
import { parseEvents } from "./utils/postgresTables/txParsing/ParseTx.js";
import { subscribeToNewBlocks } from "./utils/postgresTables/CurrentBlock.js";
import { preparingLiveModeForRawEvents } from "./utils/goingLive/RawTxLogsLive.js";
import { startAPI } from "./utils/api/Server.js";
import { updateTransactionsDetails } from "./utils/postgresTables/TransactionsDetails.js";
import { eventFlags } from "./utils/api/utils/EventFlags.js";
import { updateContractCreations } from "./utils/postgresTables/ContractCreations.js";
import { updatePriceMap } from "./utils/postgresTables/PriceMap.js";
import { populateTransactionCoinsWithDollarValues } from "./utils/postgresTables/TransactionCoins.js";
import { bootWsProvider } from "./utils/web3Calls/generic.js";
import { checkWsConnectionViaNewBlocks, eraseWebProvider, setupDeadWebsocketListener } from "./utils/goingLive/WebsocketConnectivityChecks.js";
import eventEmitter from "./utils/goingLive/EventEmitter.js";
import { logMemoryUsage } from "./utils/helperFunctions/QualityOfLifeStuff.js";
export async function initDatabase() {
    try {
        await db.sync();
        console.log("[✓] Database synced successfully.\n");
    }
    catch (err) {
        console.error("Error syncing database:", err);
    }
}
// await initDatabase();
// await updateProxiesFromManualList()
startAPI();
export const solveTransfersOnTheFlyFlag = false; // true = debugging. for debugging, if true, it means we ignore the db and do a fresh parse.
// await research(); // opening function for queries for a bunch of statistics
// await startTestClient();
export async function main() {
    eventFlags.canEmitGeneralTx = false;
    eventFlags.canEmitAtomicArb = false;
    eventFlags.canEmitCexDexArb = false;
    await eraseWebProvider(); // cleaning all perhaps existing WS.
    await bootWsProvider(); // starting new WS connection.
    eventEmitter.removeAllListeners();
    setupDeadWebsocketListener();
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
    eventFlags.canEmitCexDexArb = true;
    await updateBlockTimestamps();
    await updateContractCreations();
    await updatePriceMap(); // has to run before updateAtomicArbDetection
    await populateTransactionCoinsWithDollarValues();
    await parseEvents();
    await updateTransactionsDetails();
    // await updateSandwichDetection();
    eventFlags.canEmitSandwich = true;
    // await updateReceipts();
    // await updateTxTraces();
    // await updateAddressCounts();
    // await updateCleanedTransfers();
    // await updateAtomicArbDetection();
    // await updateCexDexArbDetection(); // requires updateCleanedTransfers to have run
    // await updateLabels(); // muted, only has to run when there are changes made to the labels-file
    // todo
    logMemoryUsage();
    console.log(`\n[✓] Everything finished syncing successfully.`);
    await checkWsConnectionViaNewBlocks(); // restarts main if WS dead for 30s.
    // process.exit();
}
await main();
//# sourceMappingURL=App.js.map