import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { getHistoricalTokenPriceFromDefiLlama } from '../../utils/TokenPrices/txValue/DefiLlama.js';
import { getReceiptByTxHash } from '../../utils/postgresTables/readFunctions/Receipts.js';
import { findUpdateCallerTokenReceivedProvide, findUpdateCallerTokenReceivedWithdraw } from './Utils.js';
import { getTxReceipt, web3Call } from '../../utils/web3Calls/generic.js';
import { getContractPegKeeperHttp, getContractPoolHttp } from './ContractGetter.js';
export async function fetchActivePegKeepers() {
    const url = 'https://prices.curve.fi/v1/crvusd/pegkeepers/ethereum';
    try {
        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const data = (await response.json());
        const activePegKeepers = data.keepers.filter((keeper) => keeper.active);
        return activePegKeepers;
    }
    catch (error) {
        console.error(`Error fetching pegkeepers: ${error}`);
        return [];
    }
}
export async function fetchPegKeeperEvents(keeperAddress, page = 1, pagination = 100) {
    const url = `https://prices.curve.fi/v1/crvusd/pegkeepers/ethereum/${keeperAddress}?page=${page}&pagination=${pagination}`;
    try {
        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const data = (await response.json());
        return data.events;
    }
    catch (error) {
        console.error(`Error fetching pegkeeper events: ${error}`);
        return [];
    }
}
async function processSinglePegkeeper(pegKeeperAddy, poolAddress, pegKeeperContract, poolContract) {
    const events = await fetchPegKeeperEvents(pegKeeperAddy);
    const results = [];
    for (const event of events) {
        const res = await processSingleEvent(event, pegKeeperAddy, poolAddress, pegKeeperContract, poolContract);
        if (res)
            results.push(res);
    }
    return results;
}
async function processSingleEvent(event, pegKeeperAddy, poolAddress, pegKeeperContract, poolContract) {
    if (event.action_type !== 'Withdraw' && event.action_type !== 'Provide')
        return null;
    const ethPrice = await getHistoricalTokenPriceFromDefiLlama('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', event.timestamp);
    if (!ethPrice)
        return null;
    let receipt = await getReceiptByTxHash(event.transaction_hash);
    if (!receipt) {
        receipt = await getTxReceipt(event.transaction_hash);
    }
    if (!receipt)
        return null;
    const gwei = Number(receipt.effectiveGasPrice);
    const gasUsed = Number(receipt.gasUsed);
    const txCostUSD = (gasUsed * (gwei * ethPrice)) / 1e18;
    const updateCallerTokenReceived = event.action_type === 'Withdraw'
        ? findUpdateCallerTokenReceivedWithdraw(receipt, pegKeeperAddy)
        : findUpdateCallerTokenReceivedProvide(receipt, pegKeeperAddy, poolAddress);
    let usdAmountOutForReceivedLP = await web3Call(poolContract, 'calc_withdraw_one_coin', [updateCallerTokenReceived, 0], event.block_number);
    usdAmountOutForReceivedLP = usdAmountOutForReceivedLP / 1e6;
    if (usdAmountOutForReceivedLP > 1000000) {
        usdAmountOutForReceivedLP = usdAmountOutForReceivedLP / 1e12;
    }
    const botNetProfitUSD = usdAmountOutForReceivedLP - txCostUSD;
    const gross = usdAmountOutForReceivedLP;
    const net = botNetProfitUSD;
    // Check blocks -20 to +20 around the base block
    //   const blockNumber = event.block_number;
    //   for (let i = -3; i <= 1; i++) {
    //     const blockNumber2 = blockNumber + i;
    //     const estimatedCallerProfit = await web3Call(pegKeeperContract, 'estimate_caller_profit', [], blockNumber2);
    //     console.log(`Block ${blockNumber2} (${i > 0 ? '+' : ''}${i}): ${estimatedCallerProfit / 1e18}`);
    //   }
    return {
        eventType: event.action_type,
        blockNumber: event.block_number,
        timestamp: event.timestamp,
        ethPrice,
        txCostUSD,
        gross,
        net,
        transactionHash: event.transaction_hash,
    };
}
export async function startPegKeeperCallProfit_Risk() {
    console.time();
    const activePegKeepers = await fetchActivePegKeepers();
    const allEvents = [];
    let counter = 0;
    for (const keeper of activePegKeepers) {
        console.log('Fetching for Keeper', keeper.pool, counter, '/', activePegKeepers.length);
        counter++;
        const pegKeeperContract = await getContractPegKeeperHttp(keeper.address);
        const poolContract = await getContractPoolHttp(keeper.pool_address);
        const events = await processSinglePegkeeper(keeper.address, keeper.pool_address, pegKeeperContract, poolContract);
        allEvents.push(...events);
    }
    // Aggregate by transaction hash
    const txHashAggregates = new Map();
    for (const event of allEvents) {
        const txHash = event.transactionHash;
        if (!txHashAggregates.has(txHash)) {
            txHashAggregates.set(txHash, { totalGross: 0, events: [] });
        }
        const txData = txHashAggregates.get(txHash);
        txData.totalGross += event.gross;
        txData.events.push(event);
    }
    // Update each pegkeeper event with the aggregated net profit
    const updatedResults = [];
    for (const keeper of activePegKeepers) {
        const pegKeeperEvents = [];
        for (const event of allEvents.filter((e) => e.transactionHash && txHashAggregates.has(e.transactionHash))) {
            const { totalGross } = txHashAggregates.get(event.transactionHash);
            pegKeeperEvents.push(Object.assign(Object.assign({}, event), { net: totalGross - event.txCostUSD }));
        }
        updatedResults.push({ pegKeeper: keeper.address, events: pegKeeperEvents });
    }
    // Format as JSON and output
    const jsonResult = updatedResults.map((result) => ({
        PegKeeper: result.pegKeeper,
        Events: result.events.map((event) => ({
            EventType: event.eventType,
            BlockNumber: event.blockNumber,
            Timestamp: event.timestamp,
            Date: new Date(event.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19),
            TxCostUSD: event.txCostUSD.toFixed(2),
            GrossUSD: event.gross.toFixed(2),
            NetUSD: event.net.toFixed(2),
            TransactionHash: event.transactionHash,
        })),
    }));
    console.dir(jsonResult, { depth: null });
    const filePath = path.join(new URL('.', import.meta.url).pathname, 'pegkeeper_results.json');
    fs.writeFileSync(filePath, JSON.stringify(jsonResult, null, 2), 'utf-8');
    console.timeEnd();
}
//# sourceMappingURL=Pegkeepers.js.map