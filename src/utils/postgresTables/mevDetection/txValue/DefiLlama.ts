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
