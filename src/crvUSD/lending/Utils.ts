import fetch from 'node-fetch';

interface TokenInfo {
  symbol: string;
  address: string;
}

export interface LendingMarketData {
  name: string;
  controller: string;
  vault: string;
  llamma: string;
  policy: string;
  oracle: string;
  oracle_pools: string[];
  rate: number;
  borrow_apy: number;
  lend_apy: number;
  n_loans: number;
  price_oracle: number;
  amm_price: number;
  base_price: number;
  total_debt: number;
  total_assets: number;
  total_debt_usd: number;
  total_assets_usd: number;
  minted: number;
  redeemed: number;
  minted_usd: number;
  redeemed_usd: number;
  loan_discount: number;
  liquidation_discount: number;
  min_band: number;
  max_band: number;
  collateral_balance: number;
  borrowed_balance: number;
  collateral_balance_usd: number;
  borrowed_balance_usd: number;
  collateral_token: TokenInfo;
  borrowed_token: TokenInfo;
}

interface LendingMarketsResponse {
  chain: string;
  page: number;
  per_page: number;
  count: number;
  data: LendingMarketData[];
}

export async function fetchLendingMarketsForChain(chain: string): Promise<LendingMarketsResponse> {
  const url = `https://prices.curve.fi/v1/lending/markets/${chain}?fetch_on_chain=false&page=1&per_page=200`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = (await response.json()) as LendingMarketsResponse;
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
}
