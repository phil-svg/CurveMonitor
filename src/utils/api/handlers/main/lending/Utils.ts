import axios from 'axios';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

interface MarketSnapshot {
  market_name: string;
  controller: string;
  first_snapshot: string;
  last_snapshot: string;
}

export interface UserMarketDataResponse {
  user: string;
  page: number;
  per_page: number;
  count: number;
  markets: MarketSnapshot[];
}

export async function checkMarketsForLendingUser(
  chain: string,
  userAddress: string,
  page: number = 1,
  perPage: number = 50
): Promise<UserMarketDataResponse | null> {
  const url = `https://prices.curve.fi/v1/lending/users/${chain}/${userAddress}?page=${page}&per_page=${perPage}`;

  try {
    const response = await axios.get<UserMarketDataResponse>(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (response.status === 200) {
      return response.data;
    } else {
      console.error('Failed to fetch data:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

export interface HealthDataPoint {
  timestamp: number;
  blockNumber: number;
  health: number;
}

export interface MarketHealthData {
  marketName: string;
  userAddress: string;
  controllerAddress: string;
  healthDataPoints: HealthDataPoint[];
}

export async function getRecentHealthDataForAllMarketsOfUser(
  marketsForLendingUser: UserMarketDataResponse
): Promise<MarketHealthData[] | null> {
  const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP!));

  if (marketsForLendingUser.markets.length === 0) {
    return null;
  }

  const allMarketHealthData: MarketHealthData[] = [];

  const currentBlock = await web3HttpProvider.eth.getBlockNumber();

  for (const market of marketsForLendingUser.markets) {
    const healthData = await getRecentHealthDataForMarket(
      marketsForLendingUser.user,
      market.controller,
      web3HttpProvider,
      currentBlock
    );
    if (healthData.length > 0) {
      allMarketHealthData.push({
        marketName: market.market_name,
        userAddress: marketsForLendingUser.user,
        controllerAddress: market.controller,
        healthDataPoints: healthData,
      });
    }
  }

  return allMarketHealthData;
}

export async function getRecentHealthDataForMarket(
  userAddress: string,
  controllerAddress: string,
  web3HttpProvider: Web3,
  currentBlock: number
): Promise<HealthDataPoint[]> {
  const currentBlockTime = Math.floor(Date.now() / 1000);

  let healthData: HealthDataPoint[] = [];

  // fetching last 5 blocks
  for (let i = 0; i < 5; i++) {
    const blockNumber = currentBlock - i;
    const health = await getUserHealthForMarket(userAddress, controllerAddress, web3HttpProvider, blockNumber);
    if (health !== null) {
      const blockTimeEstimate = currentBlockTime - i * 12; // Assuming each block approximately 12 seconds apart.
      healthData.push({
        timestamp: blockTimeEstimate,
        blockNumber: blockNumber,
        health: health,
      });
    }
  }

  return healthData;
}

async function getUserHealthForMarket(
  userAddress: string,
  controllerAddress: string,
  web3HttpProvider: Web3,
  blockNumber?: number
): Promise<number | null> {
  try {
    const ABI_HEALTH: AbiItem[] = [
      {
        stateMutability: 'view',
        type: 'function',
        name: 'health',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'int256' }],
      },
    ];
    const contract = new web3HttpProvider.eth.Contract(ABI_HEALTH, controllerAddress);
    const health = blockNumber
      ? (await contract.methods.health(userAddress).call(blockNumber)) / 1e16
      : (await contract.methods.health(userAddress).call()) / 1e16;
    return health;
  } catch (error) {
    return null;
  }
}

export interface RealTimeMarketHealthData {
  marketName: string;
  userAddress: string;
  controllerAddress: string;
  health: number;
  timestamp: number;
}

export async function getRealTimeHealthDataForAllMarketsOfUser(
  marketsForLendingUser: UserMarketDataResponse
): Promise<RealTimeMarketHealthData[] | null> {
  const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP!));

  if (marketsForLendingUser.markets.length === 0) {
    return null;
  }

  const allMarketRealTimeHealth: RealTimeMarketHealthData[] = [];

  for (const market of marketsForLendingUser.markets) {
    const health = await getUserHealthForMarket(marketsForLendingUser.user, market.controller, web3HttpProvider);
    if (health !== null) {
      allMarketRealTimeHealth.push({
        marketName: market.market_name,
        userAddress: marketsForLendingUser.user,
        controllerAddress: market.controller,
        health: health,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  }

  return allMarketRealTimeHealth;
}
