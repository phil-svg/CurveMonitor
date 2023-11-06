import axios from "axios";
export async function getCurrentTokenPriceFromDefiLlama(token) {
    try {
        const url = `https://coins.llama.fi/prices/current/ethereum:${token}?searchWidth=4h`;
        const response = await axios.get(url);
        const fullTokenKey = `ethereum:${token}`;
        if (response.data.coins[fullTokenKey]) {
            return response.data.coins[fullTokenKey].price;
        }
        else {
            console.log(`No price data for token: ${token}`);
        }
    }
    catch (err) {
        console.log(`Failed to fetch price from DefiLlama for token: ${token}, error: ${err}`);
    }
    return null;
}
export async function getHistoricalTokenPriceFromDefiLlama(tokenAddress, unixTimestamp) {
    try {
        const url = `https://coins.llama.fi/prices/historical/${unixTimestamp}/ethereum:${tokenAddress}?searchWidth=4h`;
        const response = await axios.get(url);
        const fullTokenKey = `ethereum:${tokenAddress}`;
        if (response.data.coins[fullTokenKey]) {
            return response.data.coins[fullTokenKey].price;
        }
        else {
            console.log(`No historical price data for token: ${tokenAddress} at timestamp: ${unixTimestamp}`);
        }
    }
    catch (err) {
        console.log(`Failed to fetch historical price from DefiLlama for token: ${tokenAddress} at timestamp: ${unixTimestamp}, error: ${err}`);
    }
    return null;
}
//# sourceMappingURL=DefiLlama%20copy.js.map