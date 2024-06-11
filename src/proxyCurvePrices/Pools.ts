import fetch from 'node-fetch';

export interface CurveResponse {
  chain: string;
  count: number;
  page: number;
  per_page: number;
  total: {
    total_tvl: number;
    trading_volume_24h: number;
    trading_fee_24h: number;
    liquidity_volume_24h: number;
    liquidity_fee_24h: number;
  };
  data: Array<{
    name: string;
    address: string;
    n_coins: number;
    tvl_usd: number;
    trading_volume_24h: number;
    trading_fee_24h: number;
    liquidity_volume_24h: number;
    liquidity_fee_24h: number;
    coins: Array<{
      pool_index: number;
      symbol: string;
      address: string;
    }>;
    base_daily_apr: number;
    base_weekly_apr: number;
    virtual_price: string;
    pool_methods: string[];
  }>;
}

interface ChainsResponse {
  data: Array<{ name: string }>;
}

export async function fetchChainNames(): Promise<string[]> {
  const url = 'https://prices.curve.fi/v1/chains/';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = (await response.json()) as ChainsResponse;
    return result.data.map((chain) => chain.name);
  } catch (error) {
    console.error('Error fetching chain names:', error);
    return [];
  }
}

export async function fetchDataForChain(chainName: string): Promise<CurveResponse | null> {
  console.log(`Fetching data for ${chainName}...`);
  const url = `https://prices.curve.fi/v1/chains/${chainName}?page=1&per_page=100`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CurveResponse = (await response.json()) as CurveResponse;
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${chainName}:`, error);
    return null;
  }
}

export async function fetchCurvePoolData(): Promise<void> {
  const chainNames = await fetchChainNames();

  for (const chainName of chainNames) {
    console.time(`fetchDataForChain-${chainName}`);
    await fetchDataForChain(chainName);
    console.timeEnd(`fetchDataForChain-${chainName}`);
    console.log('');
  }
}
