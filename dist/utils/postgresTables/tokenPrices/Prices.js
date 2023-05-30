import { Pool } from "../../../models/Pools.js";
import { updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
import { findCoinAddressById, findCoinIdByAddress, findCoinSymbolByAddress, findCoinSymbolById } from "../readFunctions/Coins.js";
import { getEarliestPoolInceptionByCoinId } from "../readFunctions/Pools.js";
import { countNullDollarValueForCoin, findAllFullyPricedCoinsIds, findAndModifySwapTransactions, getAllCoinIds, getAllUniqueSwapCounterPartCoinIds, getTotalEntriesForCoin, } from "../readFunctions/TransactionCoins.js";
import { getActivePools } from "../readFunctions/Transactions.js";
import { getFirstCoinAppearanceOnDefillama, getHistoricalPriceChart, getHistoricalPriceOnce } from "./DefillamaAPI.js";
import { extrapolateMultiple, getCoinIdsAboveThreshold, missingCounterUpdate, updateMostStableDollarCoinPrices } from "../../helperFunctions/Prices.js";
async function generalDebuggingInfo() {
    const ALL_COIN_IDS = await getAllCoinIds();
    let i = 0;
    for (const COIN_ID of ALL_COIN_IDS) {
        const COIN_SYMBOL = await findCoinSymbolById(COIN_ID);
        const nullDollarValueForCoin = await countNullDollarValueForCoin(COIN_ID);
        const totalEntriesForCoin = await getTotalEntriesForCoin(COIN_ID);
        if (nullDollarValueForCoin < 150)
            continue;
        console.log(`Coin: ${COIN_ID} (${COIN_SYMBOL}), ${nullDollarValueForCoin} of ${totalEntriesForCoin} price entries missing.`);
        i++;
    }
}
async function testCoinTree() {
    let allIds = await getAllCoinIds();
    console.log("found", allIds.length, "different coins moved");
    let activePools = await getActivePools();
    let graph = await buildGraph(activePools);
    let coinsWithRoutes = [];
    let coinsWithoutRoutes = [];
    for (let coinId of allIds) {
        let coinAddress = await findCoinAddressById(coinId);
        // Try to find a route to each of the stable coins
        const USDC_Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        const USDT_Address = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
        const DAI_Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        let TreeRootCoins = [USDC_Address, USDT_Address, DAI_Address];
        let foundRoute = false;
        for (let treeRootCoin of TreeRootCoins) {
            if (hasPath(graph, coinAddress, treeRootCoin)) {
                foundRoute = true;
                break;
            }
        }
        if (foundRoute) {
            coinsWithRoutes.push(coinAddress);
        }
        else {
            coinsWithoutRoutes.push(coinAddress);
        }
    }
    console.log("Coins with a swap route to USDC, USDT, or DAI: ", coinsWithRoutes.length);
    console.log("Coins without a swap route to USDC, USDT, or DAI: ", coinsWithoutRoutes.length);
    for (let k = 0; k < coinsWithoutRoutes.length; k++) {
        let symbol = await findCoinSymbolByAddress(coinsWithoutRoutes[k]);
        console.log(coinsWithoutRoutes[k], symbol);
    }
}
async function buildGraph(activePools) {
    var _a;
    const graph = new Map();
    for (const poolId of activePools) {
        const pool = await Pool.findOne({ where: { id: poolId } });
        if (pool && pool.coins) {
            const coins = pool.coins;
            for (let i = 0; i < coins.length; i++) {
                for (let j = 0; j < coins.length; j++) {
                    if (i !== j) {
                        if (graph.has(coins[i])) {
                            (_a = graph.get(coins[i])) === null || _a === void 0 ? void 0 : _a.push(coins[j]);
                        }
                        else {
                            graph.set(coins[i], [coins[j]]);
                        }
                    }
                }
            }
        }
    }
    return graph;
}
function hasPath(graph, start, target) {
    const visited = new Set();
    const stack = [start];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined)
            continue;
        if (node === target)
            return true;
        if (!visited.has(node)) {
            visited.add(node);
            if (graph.has(node)) {
                stack.push(...graph.get(node));
            }
        }
    }
    return false;
}
async function brainStormDefiLlama() {
    let coinAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    let historicalPriceOnce = await getHistoricalPriceOnce(coinAddress, 1661212800);
    console.log("historicalPriceOnce", historicalPriceOnce);
    let id = await findCoinIdByAddress(coinAddress);
    let firstCoinApprearanceCurve = await getEarliestPoolInceptionByCoinId(id);
    console.log("firstCoinApprearanceCurve", firstCoinApprearanceCurve);
    let historicalPriceChart = await getHistoricalPriceChart([coinAddress], 1548896409, 1000, "1d", "600");
    console.log("historicalPriceChart", historicalPriceChart, historicalPriceChart === null || historicalPriceChart === void 0 ? void 0 : historicalPriceChart.length);
    let firstCoinAppearanceOnDefillama = await getFirstCoinAppearanceOnDefillama(coinAddress);
    console.log("firstCoinAppearanceOnDefillama", firstCoinAppearanceOnDefillama);
}
async function initiateMostStableDollarCoin() {
    const ADDRESS_MOST_STABLE_DOLLAR_COIN = process.env.ADDRESS_MOST_STABLE_DOLLAR_COIN;
    if (!ADDRESS_MOST_STABLE_DOLLAR_COIN) {
        console.log("Please provide ADDRESS_MOST_STABLE_DOLLAR_COIN in .env");
        return;
    }
    const COIN_ID_MOST_STABLE_DOLLAR_COIN = await findCoinIdByAddress(ADDRESS_MOST_STABLE_DOLLAR_COIN);
    if (!COIN_ID_MOST_STABLE_DOLLAR_COIN)
        return;
    await updateMostStableDollarCoinPrices(COIN_ID_MOST_STABLE_DOLLAR_COIN);
}
async function runBrachingWaves() {
    let prevLength = 0;
    let waveCounter = 1;
    while (true) {
        const allPricedCoins = await findAllFullyPricedCoinsIds();
        if (allPricedCoins.length === prevLength)
            break;
        prevLength = allPricedCoins.length;
        console.log(`Running Wave ${waveCounter}`);
        waveCounter++;
        for (const pricedCoinId of allPricedCoins) {
            const uniqueSwapCounterPartCoinIds = await getAllUniqueSwapCounterPartCoinIds(pricedCoinId);
            const newSwapCounterPartCoinIds = uniqueSwapCounterPartCoinIds.filter((id) => !allPricedCoins.includes(id));
            for (const unpricedCoinId of newSwapCounterPartCoinIds) {
                await findAndModifySwapTransactions(pricedCoinId, unpricedCoinId);
            }
            const coinIdsAboveThreshold = await getCoinIdsAboveThreshold(pricedCoinId, newSwapCounterPartCoinIds);
            if (coinIdsAboveThreshold.length > 0)
                await extrapolateMultiple(coinIdsAboveThreshold);
        }
    }
}
async function treeBranching() {
    await initiateMostStableDollarCoin();
    await runBrachingWaves();
}
export async function updateTokenDollarValues() {
    await missingCounterUpdate();
    console.log("");
    await treeBranching();
    await generalDebuggingInfo();
    console.log("");
    await missingCounterUpdate();
    updateConsoleOutput("[✓] Prices solved successfully.\n");
}
//# sourceMappingURL=Prices.js.map