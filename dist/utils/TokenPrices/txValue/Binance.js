import Binance from "node-binance-api";
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_KEY,
    APISECRET: process.env.BINANCE_SECRET,
});
import fetch from "node-fetch";
const API_URL = "https://api.binance.com";
// Function to test connectivity
export async function testConnectivity() {
    try {
        const response = await fetch(`${API_URL}/api/v3/ping`);
        return response.ok;
    }
    catch (error) {
        console.error("Error testing connectivity:", error);
        return false;
    }
}
// Function to check server time
export async function getServerTime() {
    try {
        const response = await fetch(`${API_URL}/api/v3/time`);
        const data = await response.json();
        return data.serverTime;
    }
    catch (error) {
        console.error("Error fetching server time:", error);
        return null;
    }
}
// Function to get exchange information
export async function getExchangeInfo() {
    try {
        const response = await fetch(`${API_URL}/api/v3/exchangeInfo`);
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error fetching exchange information:", error);
        return null;
    }
}
// Function to fetch historical kline data
export async function fetchHistoricalKlines(symbol, startTime, endTime) {
    try {
        const response = await fetch(`${API_URL}/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=1`);
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error fetching historical klines:", error);
        return null;
    }
}
/**
 * Fetches a list of the most recent trades for a given symbol from the Binance API.
 *
 * @param symbol - The trading symbol to fetch trades for (e.g., 'BTCUSDT').
 * @param limit - The maximum number of trades to fetch (default is 1000, the maximum allowed by the API).
 * @returns A promise that resolves to an array of Trade objects.
 *
 * @example
 * ```
 * getRecentBinanceTrades('BTCUSDT').then(trades => {
 *   console.log(trades);
 * });
 * ```
 */
export async function getRecentBinanceTrades(symbol, limit = 1000) {
    const url = `${API_URL}/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const trades = (await response.json());
        return trades;
    }
    catch (error) {
        console.error("Error fetching recent Binance trades:", error);
        return [];
    }
}
/**
 * Filters trades to find those that occurred within a specified time range around a given timestamp.
 *
 * @param trades - The array of trades to search through.
 * @param targetTimestamp - The UNIX timestamp (in milliseconds) to compare against.
 * @param rangeInSeconds - The range (in seconds) around the target timestamp to include trades.
 * @returns An array of trades that occurred within the specified time range of the target timestamp.
 */
export function filterBinanceTradesByTimestamp(trades, targetTimestamp, rangeInSeconds = 5) {
    const lowerBound = targetTimestamp - rangeInSeconds * 1000;
    const upperBound = targetTimestamp + rangeInSeconds * 1000;
    return trades.filter((trade) => {
        return trade.time >= lowerBound && trade.time <= upperBound;
    });
}
//# sourceMappingURL=Binance.js.map