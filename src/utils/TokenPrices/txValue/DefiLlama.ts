import axios from 'axios';

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

export async function getHistoricalTokenPriceFromDefiLlama(
  tokenAddress: string,
  unixTimestamp: number
): Promise<number | null> {
  try {
    const url = `https://coins.llama.fi/prices/historical/${unixTimestamp}/ethereum:${tokenAddress}?searchWidth=4h`;
    const response = await axios.get<LlamaPriceResponse>(url);
    const fullTokenKey = `ethereum:${tokenAddress}`;

    if (response.data.coins[fullTokenKey]) {
      return response.data.coins[fullTokenKey].price;
    } else {
      console.log(`No historical price data for token: ${tokenAddress} at timestamp: ${unixTimestamp}`);
    }
  } catch (err) {
    console.log(
      `Failed to fetch historical price from DefiLlama for token: ${tokenAddress} at timestamp: ${unixTimestamp}, error: ${err}`
    );
  }

  return null;
}

interface FirstPriceResponse {
  symbol: string;
  price: number;
  timestamp: number;
}

interface FirstPricesApiResponse {
  coins: {
    [key: string]: FirstPriceResponse;
  };
}

// Fetches the first recorded price data for a given token from the DeFiLlama API.
export async function getFirstTokenPriceData(tokenAddress: string): Promise<FirstPriceResponse | null> {
  try {
    const prefixedTokenAddress = tokenAddress.startsWith('ethereum:') ? tokenAddress : `ethereum:${tokenAddress}`;

    const url = `https://coins.llama.fi/prices/first/${prefixedTokenAddress}`;

    const response = await axios.get<FirstPricesApiResponse>(url);

    if (response.data.coins[prefixedTokenAddress]) {
      return response.data.coins[prefixedTokenAddress];
    } else {
      console.log(`No first price data for token address: ${tokenAddress}`);
      return null;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error response:', error.response);
      console.error('Axios error request:', error.request);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    return null;
  }
}

interface PriceData {
  timestamp: number;
  price: number;
}

interface LlamaCoinResponse {
  symbol: string;
  confidence: number;
  decimals: number;
  prices: PriceData[];
}

interface LlamaChartResponse {
  coins: {
    [key: string]: LlamaCoinResponse;
  };
}

/**
 * Fetches chart data for a given token over a specified time range from the DeFiLlama API.
 *
 * @param {string} tokenAddress - The Ethereum address of the token prefixed with 'ethereum:'.
 * @param {number} start - The Unix timestamp for the start of the desired time range.
 * @param {number} span - The number of data points to return.
 * @param {string} period - The duration between data points (e.g., '1d' for daily).
 * @param {number} searchWidth - The time range on either side of the data point to search for price data, as a number of seconds.
 * @returns {Promise<LlamaCoinResponse | null>} A promise that resolves to the chart data or null if an error occurs.
 */
export async function getTokenPriceChartData(
  tokenAddress: string,
  start: number,
  span: number,
  period: string,
  searchWidth: number
): Promise<LlamaCoinResponse | null | 'missing'> {
  const tokenQueryParam = `ethereum:${tokenAddress}`;
  const url = `https://coins.llama.fi/chart/${tokenQueryParam}`;

  try {
    const params = {
      start, // Unix timestamp of earliest data point requested
      span, // Number of data points returned
      period, // Duration between data points
      searchWidth, // Time range on either side to find price data
    };

    const response = await axios.get<LlamaChartResponse>(url, { params });

    if (response.data.coins && Object.keys(response.data.coins).length === 0) {
      return 'missing'; // (response.data.coins = {})
    } else if (response.data.coins && response.data.coins[tokenQueryParam]) {
      return response.data.coins[tokenQueryParam];
    } else {
      // If coins is null, undefined, or tokenQueryParam is not a property in the coins object
      console.log(`Unexpected response structure or no data for token address: ${tokenAddress}`);
      return null; // or handle this case as you see fit
    }
  } catch (error) {
    console.log('defillama price fetched failed for', tokenAddress);
    return null;
  }
}

export async function getPricesForAllTokensFromDefiLlama(
  tokens: Set<string>,
  block_unixtime: number
): Promise<Map<string, number> | null> {
  try {
    const prices = new Map<string, number>();

    for (const token of tokens) {
      const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);

      if (!price) {
        console.log(`Failed to fetch price in getPricesForAllTokensFromDefiLlama for token: ${token}`);
        return null;
      }

      prices.set(token, price);
    }

    return prices;
  } catch (error) {
    console.log('Error fetching prices for tokens: ', error);
    return null;
  }
}
