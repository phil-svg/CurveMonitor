import { TransactionDetails } from '../../models/TransactionDetails.js';
import { eventFlags } from '../api/utils/EventFlags.js';
import { getCurrentFormattedTime } from '../helperFunctions/QualityOfLifeStuff.js';
import { getContractByAddressWithWebsocket } from '../helperFunctions/Web3.js';
import { insertAtomicArbDetails } from '../postgresTables/AtomicArbs.js';
import { insertTokenTransfers, solveCleanTransfersForTx } from '../postgresTables/CleanedTransfers.js';
import { fetchContractAgeInRealtime } from '../postgresTables/ContractCreations.js';
import { storeCexDexArbFlag } from '../postgresTables/IsCexDexArb.js';
import { updatePriceMap } from '../postgresTables/PriceMap.js';
import { storeEvent } from '../postgresTables/RawLogs.js';
import { fetchAndSaveReceipt } from '../postgresTables/Receipts.js';
import { populateTransactionCoinsWithDollarValuesForSingleTx } from '../postgresTables/TransactionCoins.js';
import { updateValueUsdForSingleTx } from '../postgresTables/TransactionPricing.js';
import { saveTransactionTrace } from '../postgresTables/TransactionTraces.js';
import { solveSingleTdId } from '../postgresTables/TransactionsDetails.js';
import { fetchDataThenDetectArb } from '../postgresTables/mevDetection/atomic/atomicArb.js';
import { processSinglCexDexTxId } from '../postgresTables/mevDetection/cexdex/CexDexArb.js';
import { isCexDexArb } from '../postgresTables/mevDetection/cexdex/utils/cexdexDetection.js';
import { findCandidatesInBatch } from '../postgresTables/mevDetection/sandwich/SandwichDetection.js';
import { addAddressesForLabelingForBlock } from '../postgresTables/mevDetection/sandwich/SandwichUtils.js';
import { getTimestampsByBlockNumbersFromLocalDatabase } from '../postgresTables/readFunctions/Blocks.js';
import { getCoinsInBatchesByPools, getPoolIdByPoolAddress } from '../postgresTables/readFunctions/Pools.js';
import { fetchEventsForChunkParsing } from '../postgresTables/readFunctions/RawLogs.js';
import { fetchTransactionsForBlock } from '../postgresTables/readFunctions/Transactions.js';
import { sortAndProcess } from '../postgresTables/txParsing/ParseTx.js';
import { retryGetTransactionTraceViaWeb3Provider } from '../web3Calls/generic.js';
import eventEmitter from './EventEmitter.js';
import EventEmitter from './EventEmitter.js';
// when histo-parsing is finished, subscribe to new events.
export async function preparingLiveModeForRawEvents() {
    eventEmitter.on('ready for subscription', subscribeToAddress);
    eventEmitter.on('new block spotted', processBufferedEvents);
    EventEmitter.on('dead websocket connection', async () => {
        return;
    });
}
let eventBuffer = [];
async function getPoolCoinsForLiveMode() {
    const poolAddresses = eventBuffer.map((event) => event.address); // Get all addresses from the events
    const poolIdsPromises = poolAddresses.map(getPoolIdByPoolAddress); // Convert each address to a Promise<id>
    const poolIds = await Promise.all(poolIdsPromises); // Await all promises to get an array of ids
    const validPoolIds = poolIds.filter((id) => id !== null);
    const POOL_COINS = await getCoinsInBatchesByPools(validPoolIds);
    return POOL_COINS;
}
function bufferEvent(address, event) {
    if (!eventBuffer.some((e) => e.address === address && JSON.stringify(e.event) === JSON.stringify(event))) {
        eventBuffer.push({ address, event });
    }
}
// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
export async function subscribeToAddress(address) {
    // console.log('called subscribeToAddress, voiding for clean debugging purposes');
    // return;
    const contract = await getContractByAddressWithWebsocket(address);
    const poolId = await getPoolIdByPoolAddress(address);
    if (!contract)
        return;
    if (!poolId)
        return;
    const subscription = contract.events
        .allEvents({ fromBlock: 'latest' })
        .on('data', async (event) => {
        console.log(`New Event spotted at ${getCurrentFormattedTime()}`);
        // lastEventTime = Date.now();
        await storeEvent(event, poolId);
        bufferEvent(address, event);
    })
        .on('error', (error) => {
        console.log(`Subscription error: ${error}`);
    });
}
async function saveParsedEventInLiveMode(parsedTx) {
    console.log('saveParsedEventInLiveMode', parsedTx);
    // solving called contract
    const transactionIds = parsedTx.map((tx) => tx.tx_id).filter((id) => id !== undefined);
    const calledContractPromises = transactionIds.map((txId) => solveSingleTdId(txId));
    const calledContractAddresses = await Promise.all(calledContractPromises);
    // Filter out null results
    const validCalledContractAddresses = calledContractAddresses.filter((address) => address !== null);
    // Save to the database + Emit Event
    for (const data of validCalledContractAddresses) {
        try {
            await fetchContractAgeInRealtime(data.hash, data.to);
            const existingTransaction = await TransactionDetails.findOne({ where: { txId: data.txId } });
            if (!existingTransaction) {
                await TransactionDetails.upsert(data);
                if (eventFlags.canEmitGeneralTx) {
                    eventEmitter.emit('New Transaction for General-Transaction-Livestream', data.txId);
                }
            }
        }
        catch (err) {
            console.log(`Failed to solve called contract in live-mode for txId: ${data.txId}`, err);
            console.log(`Data causing error:`, JSON.stringify(data, null, 2));
        }
    }
}
export function getUniqueTransactions(transactions) {
    const uniqueTxHashes = new Set();
    const uniqueTxArray = [];
    for (const tx of transactions) {
        if (!uniqueTxHashes.has(tx.tx_hash)) {
            uniqueTxHashes.add(tx.tx_hash);
            uniqueTxArray.push(tx);
        }
    }
    return uniqueTxArray;
}
// when the next block appears, we parse the prev block.
async function processBufferedEvents() {
    console.log('eventBuffer', eventBuffer);
    if (eventBuffer.length === 0)
        return;
    const eventBlockNumbers = eventBuffer.flatMap((event) => event.event.blockNumber !== undefined ? [event.event.blockNumber] : []);
    const EVENTS = await fetchEventsForChunkParsing(eventBlockNumbers[0], eventBlockNumbers[eventBlockNumbers.length - 1]);
    const BLOCK_UNIXTIMES = await getTimestampsByBlockNumbersFromLocalDatabase(eventBlockNumbers);
    const poolCoins = await getPoolCoinsForLiveMode();
    // Parsing
    await sortAndProcess(EVENTS, BLOCK_UNIXTIMES, poolCoins);
    eventBuffer = [];
    const PARSED_TX = await fetchTransactionsForBlock(eventBlockNumbers[0]);
    // effectively updating coin prices once every 10 minutes (50*12s)
    if (eventBlockNumbers[0] % 50 === 0)
        await updatePriceMap();
    // Saving Parsed Tx to db
    try {
        await saveParsedEventInLiveMode(PARSED_TX);
    }
    catch (err) {
        console.log(`Err in live-mode ${err}`);
    }
    // Sandwich Detection In live-mode
    await findCandidatesInBatch(PARSED_TX);
    await addAddressesForLabelingForBlock(eventBlockNumbers[0]);
    const processedTxHashes = new Set();
    // waiting for traces to be available for pinging.
    await new Promise((resolve) => setTimeout(resolve, 18069));
    // trace + receipt + building out live-arb-detection
    const uniqueTransactions = getUniqueTransactions(PARSED_TX);
    for (const tx of uniqueTransactions) {
        const txId = tx.tx_id;
        if (!txId || processedTxHashes.has(tx.tx_hash.toLowerCase()))
            continue;
        // price-update
        if (eventFlags.txPricing) {
            await populateTransactionCoinsWithDollarValuesForSingleTx(tx);
            await updateValueUsdForSingleTx(tx);
        }
        // fetching and saving of the transaction-trace
        const transactionTrace = await retryGetTransactionTraceViaWeb3Provider(tx.tx_hash);
        if (!transactionTrace) {
            console.log('failed to fetch transaction-trace during live-mode for', tx.tx_hash);
            continue;
        }
        await saveTransactionTrace(tx.tx_hash, transactionTrace);
        const receipt = await fetchAndSaveReceipt(tx.tx_hash, txId);
        if (!receipt) {
            console.log('failed to fetch transaction-receipt during live-mode for', tx.tx_hash);
            continue;
        }
        // parsing the entire tx:
        const cleanedTransfers = await solveCleanTransfersForTx(txId, tx.tx_hash);
        if (!cleanedTransfers)
            continue;
        await insertTokenTransfers(txId, cleanedTransfers);
        const atomicArbInfo = await fetchDataThenDetectArb(txId);
        if (atomicArbInfo && atomicArbInfo !== 'not an arb') {
            await insertAtomicArbDetails(txId, atomicArbInfo);
            if (eventFlags.canEmitAtomicArb)
                eventEmitter.emit('New Transaction for Atomic-Arb-Livestream', atomicArbInfo);
        }
        const isCexDexArbitrage = await isCexDexArb(txId);
        if (isCexDexArbitrage && isCexDexArbitrage !== 'unable to fetch') {
            await storeCexDexArbFlag(txId, isCexDexArbitrage);
            await processSinglCexDexTxId(txId);
            if (eventFlags.canEmitCexDexArb)
                eventEmitter.emit('New Transaction for CexDex-Arb-Livestream', txId);
        }
        processedTxHashes.add(tx.tx_hash.toLowerCase());
    }
}
//# sourceMappingURL=RawTxLogsLive.js.map