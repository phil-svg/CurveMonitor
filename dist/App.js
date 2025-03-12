console.clear();
import { db } from './config/Database.js';
import { loadAddressProvider } from './utils/AddressProviderEntryPoint.js';
import { updatePools } from './utils/postgresTables/Pools.js';
import { updateCoinTable } from './utils/postgresTables/Coins.js';
import { updatePoolAbis } from './utils/postgresTables/Abi.js';
import { updateBlockTimestamps } from './utils/postgresTables/Blocks.js';
import { updateRawLogs, updateRawLogsForLiveMode } from './utils/postgresTables/RawLogs.js';
import { parseEvents } from './utils/postgresTables/txParsing/ParseTx.js';
import { addCustomLabels } from './utils/postgresTables/Labels.js';
import { subscribeToNewBlocks } from './utils/postgresTables/CurrentBlock.js';
import { preparingLiveModeForRawEvents } from './utils/goingLive/RawTxLogsLive.js';
import { updateTransactionsDetails } from './utils/postgresTables/TransactionsDetails.js';
import { updateAddressCounts } from './utils/postgresTables/CalledAddressCounts.js';
import { eventFlags } from './utils/api/utils/EventFlags.js';
import { updateSandwichDetection } from './utils/postgresTables/mevDetection/sandwich/SandwichDetection.js';
import { updateAtomicArbDetection } from './utils/postgresTables/mevDetection/atomic/atomicArb.js';
import { updateTxTraces } from './utils/postgresTables/TransactionTraces.js';
import { updateReceipts } from './utils/postgresTables/Receipts.js';
import { updateContractCreations } from './utils/postgresTables/ContractCreations.js';
import { updateCexDexArbDetection } from './utils/postgresTables/mevDetection/cexdex/CexDexArb.js';
import { updateCleanedTransfers } from './utils/postgresTables/CleanedTransfers.js';
import { bootWsProvider } from './utils/web3Calls/generic.js';
import { checkWsConnectionViaNewBlocks, eraseWebProvider, setupDeadWebsocketListener, } from './utils/goingLive/WebsocketConnectivityChecks.js';
import eventEmitter from './utils/goingLive/EventEmitter.js';
import { logMemoryUsage } from './utils/helperFunctions/QualityOfLifeStuff.js';
import { updateTransactionPricing } from './utils/postgresTables/TransactionPricing.js';
import { updatePoolsBytecode } from './utils/postgresTables/ByteCode.js';
import { updateMintMarketForMevScoring } from './utils/risk/MintMarkets.js';
import { startAPI } from './utils/api/Server.js';
export async function initDatabase() {
    try {
        await db.sync();
        console.log('[✓] Database synced successfully.\n');
    }
    catch (err) {
        console.error('Error syncing database:', err);
    }
}
await initDatabase();
// await updateProxiesFromManualList();
export const solveTransfersOnTheFlyFlag = false; // true = debugging. for debugging, if true, it means we ignore the db and do a fresh parse.
// await research(); // opening function for queries for a bunch of statistics
// await runSpeedTest();
export async function main() {
    console.time('booting main');
    eventFlags.canEmitGeneralTx = false;
    eventFlags.canEmitAtomicArb = false;
    eventFlags.canEmitCexDexArb = false;
    eventFlags.canEmitSandwich = false;
    eventFlags.txPricing = false;
    await eraseWebProvider(); // cleaning all perhaps existing WS.
    await bootWsProvider(); // starting new WS connection.
    eventEmitter.removeAllListeners();
    setupDeadWebsocketListener();
    await updateMintMarketForMevScoring();
    await loadAddressProvider();
    await updatePools();
    await updateCoinTable();
    await updatePoolsBytecode();
    await updatePoolAbis();
    await subscribeToNewBlocks();
    // await updateInitialPoolParams(); // muted until useful
    // await updatePoolParamsEvents(); // muted until useful
    await updateRawLogs();
    await preparingLiveModeForRawEvents();
    await updateRawLogsForLiveMode();
    eventFlags.canEmitGeneralTx = true;
    eventFlags.canEmitAtomicArb = true;
    eventFlags.canEmitCexDexArb = true;
    await updateBlockTimestamps();
    await updateContractCreations();
    await updateTransactionPricing();
    eventFlags.txPricing = true;
    await parseEvents();
    await updateTransactionsDetails();
    await updateSandwichDetection();
    eventFlags.canEmitSandwich = true;
    await updateReceipts();
    await updateTxTraces();
    await updateAddressCounts();
    await updateCleanedTransfers();
    await updateAtomicArbDetection();
    await updateCexDexArbDetection(); // requires updateCleanedTransfers to have run
    await addCustomLabels();
    // await updateLabels(); // muted, only has to run when there are changes made to the labels-file
    // todo
    console.log(`\n[✓] Everything finished syncing successfully.`);
    console.timeEnd('booting main');
    logMemoryUsage('main');
    await checkWsConnectionViaNewBlocks(); // restarts main if WS dead for 30s.
    // process.exit();
}
// await startTestClient();
// await runDemoClientForProxyABI();
startAPI({ wsBool: true }, { httpBool: true });
await main();
//# sourceMappingURL=App.js.map