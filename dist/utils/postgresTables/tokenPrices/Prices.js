import axios from "axios";
import { findCoinAddressesByIds } from "../readFunctions/Coins.js";
import { getAllPoolIds, getCoinsInBatchesByPools, getCreationTimestampBy } from "../readFunctions/Pools.js";
async function getEarliestPoolInceptionByCoinId(coinId) {
    const ALL_POOL_IDS = await getAllPoolIds();
    const coinAddress = await findCoinAddressesByIds([coinId]);
    if (!coinAddress) {
        console.log(`No address found for coin ID: ${coinId}`);
        return null;
    }
    const coinAddressStr = coinAddress[0];
    const poolCoins = await getCoinsInBatchesByPools(ALL_POOL_IDS);
    const relevantPoolIds = Object.entries(poolCoins)
        .filter(([_, coinAddresses]) => coinAddresses === null || coinAddresses === void 0 ? void 0 : coinAddresses.includes(coinAddressStr))
        .map(([poolId, _]) => Number(poolId));
    const poolTimestamps = await Promise.all(relevantPoolIds.map((poolId) => getCreationTimestampBy({ id: poolId })));
    const validPoolTimestamps = poolTimestamps.filter((timestamp) => timestamp !== null);
    if (validPoolTimestamps.length === 0) {
        console.log(`No valid timestamps found for Coin ID ${coinId}`);
        return null;
    }
    const minTimestamp = Math.min(...validPoolTimestamps);
    return minTimestamp;
}
async function getHistoricalPriceOnce(contractAddress, unixTimestamp) {
    const baseUrl = "https://coins.llama.fi";
    const endpoint = `/prices/historical/${unixTimestamp}/ethereum:${contractAddress}`;
    const url = `${baseUrl}${endpoint}`;
    try {
        const response = await axios.get(url, { params: { searchWidth: "4h" } });
        const coinPriceData = response.data.coins[`ethereum:${contractAddress}`];
        return coinPriceData ? coinPriceData.price : null;
    }
    catch (error) {
        console.error(`Failed to fetch historical price for ${contractAddress}: ${error}`);
        return null;
    }
}
async function getHistoricalPriceChart(contractAddresses, start, span, period, searchWidth) {
    const baseUrl = "https://coins.llama.fi";
    const contracts = contractAddresses.map((address) => `ethereum:${address}`).join(",");
    const endpoint = `/chart/${contracts}`;
    const url = `${baseUrl}${endpoint}?start=${start}&span=${span}&period=${period}&searchWidth=${searchWidth}`;
    try {
        const response = await axios.get(url);
        if (response.data && response.data.coins) {
            const firstContractKey = Object.keys(response.data.coins)[0];
            return response.data.coins[firstContractKey].prices;
        }
        return null;
    }
    catch (error) {
        console.error(`Failed to fetch historical price chart for ${contracts}: ${error}`);
        return null;
    }
}
export async function updateTokenDollarValues() {
    let historicalPriceOnce = await getHistoricalPriceOnce("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 1661212800);
    console.log(historicalPriceOnce);
    let historicalPriceChart = await getHistoricalPriceChart(["0xdF574c24545E5FfEcb9a659c229253D4111d87e1"], 1682467200, 10, "1d", "600");
    console.log(historicalPriceChart);
    // updateConsoleOutput("[✓] Events parsed successfully.\n");
}
//# sourceMappingURL=Prices.js.map