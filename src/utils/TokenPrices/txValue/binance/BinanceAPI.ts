import fetch from 'node-fetch';
import { EnrichedTransactionDetail } from '../../../Interfaces.js';

const API_URL = 'https://api.binance.com';

// Function to test connectivity
export async function testConnectivity() {
  try {
    const response = await fetch(`${API_URL}/api/v3/ping`);
    return response.ok;
  } catch (error) {
    console.error('Error testing connectivity:', error);
    return false;
  }
}

// Function to check server time
export async function getServerTime() {
  try {
    const response = await fetch(`${API_URL}/api/v3/time`);
    const data: any = await response.json();
    return data.serverTime;
  } catch (error) {
    console.error('Error fetching server time:', error);
    return null;
  }
}

// Function to get exchange information
export async function getExchangeInfo() {
  try {
    const response = await fetch(`${API_URL}/api/v3/exchangeInfo`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching exchange information:', error);
    return null;
  }
}

// Helper function to normalize token names to Binance symbols.
function normalizeTokenName(name: string): string {
  const map: { [key: string]: string } = {
    WBTC: 'BTC',
    WETH: 'ETH',
    // Add more mappings if needed
  };
  return map[name] || name;
}

interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

/**
 * Fetches the symbol for a trading pair given two assets from the Binance API.
 * It accounts for synonymous asset names like WBTC (Wrapped BTC) for BTC and WETH for ETH.
 *
 * @param asset1 - The first asset of the trading pair (e.g., 'WBTC' or 'BTC').
 * @param asset2 - The second asset of the trading pair (e.g., 'USDT').
 * @returns A promise that resolves to the symbol string or null if not found.
 */
export async function getFlexibleSymbolForTradingPair(asset1: string, asset2: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/v3/exchangeInfo`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const { symbols } = (await response.json()) as { symbols: SymbolInfo[] };

    // Normalize asset names
    const normalizeAssetName = (name: string) => {
      const map: { [key: string]: string } = { WBTC: 'BTC', WETH: 'ETH' };
      return map[name] || name;
    };

    const normalizedAsset1 = normalizeAssetName(asset1.toUpperCase());
    let normalizedAsset2 = normalizeAssetName(asset2.toUpperCase());

    let matchingSymbol = symbols.find(
      (symbolInfo) =>
        ((symbolInfo.baseAsset === normalizedAsset1 && symbolInfo.quoteAsset === normalizedAsset2) ||
          (symbolInfo.baseAsset === normalizedAsset2 && symbolInfo.quoteAsset === normalizedAsset1)) &&
        symbolInfo.status === 'TRADING'
    );

    // Fallback to USDT if no symbol found and asset2 is USDC or DAI
    if (!matchingSymbol && (normalizedAsset2 === 'USDC' || normalizedAsset2 === 'DAI')) {
      normalizedAsset2 = 'USDT';
      matchingSymbol = symbols.find(
        (symbolInfo) =>
          ((symbolInfo.baseAsset === normalizedAsset1 && symbolInfo.quoteAsset === normalizedAsset2) ||
            (symbolInfo.baseAsset === normalizedAsset2 && symbolInfo.quoteAsset === normalizedAsset1)) &&
          symbolInfo.status === 'TRADING'
      );
    }

    return matchingSymbol ? matchingSymbol.symbol : null;
  } catch (error) {
    console.error(`Error fetching symbol for trading pair ${asset1}/${asset2}:`, error);
    return null;
  }
}

// Function to fetch historical kline data
export async function fetchHistoricalKlines(symbol: string, startTime: number, endTime: number) {
  try {
    const response = await fetch(
      `${API_URL}/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=1`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching historical klines:', error);
    return null;
  }
}

interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
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
export async function getRecentBinanceTrades(symbol: string, limit: number = 1000): Promise<Trade[]> {
  const url = `${API_URL}/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const trades = (await response.json()) as Trade[];
    return trades;
  } catch (error) {
    console.error('Error fetching recent Binance trades:', error);
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
export function filterBinanceTradesByTimestamp(
  trades: Trade[],
  targetTimestamp: number,
  rangeInSeconds: number = 5
): Trade[] {
  const lowerBound = targetTimestamp - rangeInSeconds * 1000;
  const upperBound = targetTimestamp + rangeInSeconds * 1000;

  return trades.filter((trade) => {
    return trade.time >= lowerBound && trade.time <= upperBound;
  });
}

/**
 * Filters trades to find one that matches time, volume, and direction criteria.
 *
 * @param trades - The array of trades to search through.
 * @param targetTimestamp - The UNIX timestamp (in milliseconds) for comparison.
 * @param targetVolume - The expected volume of the trade.
 * @param isOnChainBuy - Whether the on-chain transaction was a buy.
 * @returns A matching trade or null if none is found.
 */
export function findMatchingTrade(
  trades: Trade[],
  targetTimestamp: number,
  targetVolume: number,
  isOnChainBuy: boolean
): Trade | null {
  const matchesCriteria = (trade: Trade, timeDiff: number, volumePercentage: number) => {
    const timeDelta = Math.abs(trade.time - targetTimestamp);
    const volume = parseFloat(trade.qty);
    const minVolume = targetVolume * volumePercentage;
    const directionMatches = isOnChainBuy !== trade.isBuyerMaker; // Binance trade should be a sell if on-chain is a buy, and vice versa
    return timeDelta <= timeDiff && volume >= minVolume && directionMatches;
  };

  // Define the search criteria in order of specificity
  const searchCriteria = [
    { timeDiff: 1000, volumePercentage: 0.9 },
    { timeDiff: 1000, volumePercentage: 0.8 },
    { timeDiff: 4000, volumePercentage: 0.8 },
    { timeDiff: 4000, volumePercentage: 0.7 },
    { timeDiff: 8000, volumePercentage: 0.6 },
    { timeDiff: 10000, volumePercentage: 0.1 },
  ];

  for (const criteria of searchCriteria) {
    const matchingTrade = trades.find((trade) => matchesCriteria(trade, criteria.timeDiff, criteria.volumePercentage));
    if (matchingTrade) {
      return matchingTrade;
    }
  }

  return null;
}

/**
 * Finds a matching trade on Binance based on an on-chain transaction.
 *
 * @param enrichedTransaction - The on-chain transaction details.
 * @returns A promise resolving to a matching Binance trade or null if no match is found.
 */
export async function findBestMatchingBinanceTrade(
  enrichedTransaction: EnrichedTransactionDetail
): Promise<Trade | null> {
  // console.log('enrichedTransaction', enrichedTransaction);
  const coinLeaving = enrichedTransaction.coins_leaving_wallet[0];
  // console.log('coinLeaving', coinLeaving);
  const coinEntering = enrichedTransaction.coins_entering_wallet[0];
  // console.log('coinEntering', coinEntering);

  const baseAsset = normalizeTokenName(coinLeaving.name);
  // console.log('baseAsset', baseAsset);
  const quoteAsset = normalizeTokenName(coinEntering.name);
  // console.log('quoteAsset', quoteAsset);

  try {
    const symbol = await getFlexibleSymbolForTradingPair(baseAsset, quoteAsset);
    // console.log('symbol', symbol);
    if (!symbol) {
      console.log(`No symbol found for trading pair ${baseAsset}/${quoteAsset}`);
      return null;
    }

    const recentTrades = await getRecentBinanceTrades(symbol);
    // console.log('recentTrades', recentTrades);
    const targetTimestamp = enrichedTransaction.block_unixtime * 1000;

    // On-chain transaction is a buy if the coin is entering the wallet
    const isOnChainBuy = coinEntering.name === baseAsset;

    let targetVolume = coinLeaving.amount;
    if (isOnChainBuy) {
      targetVolume = coinEntering.amount;
    }

    // console.log('isOnChainBuy', isOnChainBuy);

    const matchingTrade = findMatchingTrade(recentTrades, targetTimestamp, targetVolume, isOnChainBuy);
    // console.log('matchingTrade', matchingTrade);
    // process.exit();
    return matchingTrade;
  } catch (err) {
    // console.log('err in findBestMatchingBinanceTrade,');
    // most likely Error fetching symbol for trading pair ETH/LDO: Error: HTTP error! status: 451
    return null;
  }
}
