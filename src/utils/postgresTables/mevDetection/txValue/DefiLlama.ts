import axios from "axios";
import { copyFileSync } from "fs";

interface LlamaPriceResponse {
  coins: {
    [key: string]: {
      decimals: number;
      symbol: string;
      price: number;
      timestamp: number;
      confidence: number;
    };
  };
}

export async function getCurrentTokenPriceFromDefiLlama(token: string): Promise<number | null> {
  try {
    const url = `https://coins.llama.fi/prices/current/ethereum:${token}?searchWidth=4h`;
    const response = await axios.get<LlamaPriceResponse>(url);

    const fullTokenKey = `ethereum:${token}`;
    if (response.data.coins[fullTokenKey]) {
      return response.data.coins[fullTokenKey].price;
    } else {
      console.log(`No price data for token: ${token}`);
    }
  } catch (err) {
    console.log(`Failed to fetch price from DefiLlama for token: ${token}, error: ${err}`);
  }

  return null;
}

export async function getHistoricalTokenPriceFromDefiLlama(token: string, timestamp: number): Promise<number | null> {
  try {
    const url = `https://coins.llama.fi/prices/historical/${timestamp}/ethereum:${token}?searchWidth=4h`;
    const response = await axios.get<LlamaPriceResponse>(url);

    const fullTokenKey = `ethereum:${token}`;
    if (response.data.coins[fullTokenKey]) {
      return response.data.coins[fullTokenKey].price;
    } else {
      console.log(`No historical price data for token: ${token}`);
    }
  } catch (err) {
    console.log(`Failed to fetch historical price from DefiLlama for token: ${token}, error: ${err}`);
  }

  return null;
}

export async function getPricesForAllTokensFromDefiLlama(tokens: Set<string>, block_unixtime: number): Promise<Map<string, number> | null> {
  try {
    const prices = new Map<string, number>();

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
  } catch (error) {
    console.log("Error fetching prices for tokens: ", error);
    return null;
  }
}
