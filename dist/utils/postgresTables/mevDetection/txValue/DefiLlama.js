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
export async function getHistoricalTokenPriceFromDefiLlama(token, timestamp) {
    try {
        const url = `https://coins.llama.fi/prices/historical/${timestamp}/ethereum:${token}?searchWidth=4h`;
        const response = await axios.get(url);
        const fullTokenKey = `ethereum:${token}`;
        if (response.data.coins[fullTokenKey]) {
            return response.data.coins[fullTokenKey].price;
        }
        else {
            console.log(`No historical price data for token: ${token}`);
        }
    }
    catch (err) {
        console.log(`Failed to fetch historical price from DefiLlama for token: ${token}, error: ${err}`);
    }
    return null;
}
export async function getPricesForAllTokensFromDefiLlama(tokens, block_unixtime) {
    try {
        const prices = new Map();
        for (const token of tokens) {
            console.log(token, block_unixtime);
            const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);
            console.log(price);
            if (!price) {
                console.log(`Failed to fetch price in getPricesForAllTokensFromDefiLlama for token: ${token}`);
                return null;
            }
            prices.set(token, price);
        }
        return prices;
    }
    catch (error) {
        console.log("Error fetching prices for tokens: ", error);
        return null;
    }
}
//# sourceMappingURL=DefiLlama.js.map