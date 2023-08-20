import axios from "axios";
export async function getHistoricalPriceOnce(contractAddress, unixTimestamp) {
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
export async function getHistoricalPriceChart(contractAddresses, start, span, period, searchWidth) {
    const baseUrl = "https://coins.llama.fi";
    const contracts = contractAddresses.map((address) => `ethereum:${address}`).join(",");
    const endpoint = `/chart/${contracts}`;
    const url = `${baseUrl}${endpoint}?start=${start}&span=${span}&period=${period}&searchWidth=${searchWidth}`;
    try {
        const response = await axios.get(url);
        // console.log(response);
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
export async function getFirstCoinAppearanceOnDefillama(contractAddress) {
    const baseUrl = "https://coins.llama.fi";
    const endpoint = `/prices/first/ethereum:${contractAddress}`;
    const url = `${baseUrl}${endpoint}`;
    try {
        const response = await axios.get(url);
        const coinData = response.data.coins[`ethereum:${contractAddress}`];
        return coinData ? coinData.timestamp : null;
    }
    catch (error) {
        console.error(`Failed to fetch first appearance for ${contractAddress}: ${error}`);
        return null;
    }
}
//# sourceMappingURL=DefillamaAPI.js.map