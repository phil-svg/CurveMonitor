import fetch from 'node-fetch';
import { getSoftLiquidationRevenue, meassureSoftLiquidation } from './SoftLiquidationProfit.js';
import fs from 'fs';
import path from 'path';
import {
  getLlammaContract,
  getMintMarketControllerAbi,
  getMintMarketControllerContract,
  getMintMarketLlammaAbi,
  getMintMarketLlammaContract,
} from './Contracts.js';
import { getCurrentBlockNumber, getPastEvents, WEB3_HTTP_PROVIDER, web3Call } from '../../utils/web3Calls/generic.js';
import { Multicall, ContractCallContext, ContractCallResults } from 'ethereum-multicall';
import { getTokenDecimalWOdbForChain } from '../../utils/fiddyResearchTM/DefiMonitooor/DexAggregators/Research/AnyMEV/CleanTransfersWOdb.js';
import { getTokenDecimalsFromChain } from '../../utils/helperFunctions/Web3.js';

interface TokenInfo {
  symbol: string;
  address: string;
}

export interface MarketData {
  address: string;
  factory_address: string;
  llamma: string;
  rate: number;
  total_debt: number;
  n_loans: number;
  debt_ceiling: number | null;
  borrowable: number;
  pending_fees: number;
  collected_fees: number;
  collateral_amount: number;
  collateral_amount_usd: number;
  stablecoin_amount: number;
  collateral_token: TokenInfo;
  stablecoin_token: TokenInfo;
}

interface MarketResponse {
  chain: string;
  page: number;
  per_page: number;
  count: number;
  data: MarketData[];
}

interface LiquidationEvent {
  user: string;
  liquidator: string;
  self: boolean;
  collateral_received: number;
  collateral_received_usd: number;
  stablecoin_received: number;
  oracle_price: number;
  debt: number;
  n1: number;
  n2: number;
  dt: string;
  tx: string;
  block: number;
}

interface LiquidationEventsResponse {
  data: LiquidationEvent[];
}

interface SoftLiquidationEventInfoOld {
  date: string;
  timestamp: number;
  softLiquidationRevenue: number;
  txHash: string;
  marketName: string;
  liquidator: string;
  block: number;
}

interface SoftLiquidationEventInfo {
  date: string;
  timestamp: number;
  priceOracle: number;
  currentPrice: number;
  txHash: string;
  marketName: string;
  liquidator: string;
  block: number;
}

let allResults: SoftLiquidationEventInfo[] = [];
let events: any[] = [];
let getYUpData: any[] = [];

async function fetchMarkets(): Promise<MarketResponse> {
  const url = 'https://prices.curve.fi/v1/crvusd/markets/ethereum?fetch_on_chain=false&page=1&per_page=100';

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

    const data = (await response.json()) as MarketResponse;
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
}

async function fetchSoftLiquidationEventsForMarket(market: MarketData): Promise<any> {
  const ammContract = await getMintMarketLlammaContract(market.llamma);

  const blocksPerMonth = 5 * 60 * 24 * 30;
  // const endBlock = 21199440;
  // const startBlock = endBlock - blocksPerMonth; // aprox 1 month
  // const startBlock = endBlock - blocksPerMonth * 3; // aprox 3 month
  // const startBlock = endBlock - 5 * 60 * 24 * 7; // aprox 3 weeks

  const startBlock = 21160100 - 300;
  const endBlock = 21160100 + 300;

  const events = await getPastEvents(ammContract, 'TokenExchange', startBlock, endBlock);
  return events;
}

async function processSingleSoftLiquidationEvent(
  event: any,
  market: MarketData
): Promise<SoftLiquidationEventInfo | null> {
  try {
    ///////////// NEW ///////////
    const info = await meassureSoftLiquidation(event, market);
    if (!info) return null;
    if (!info.timestamp) return null;

    const date = new Date(info.timestamp * 1000).toISOString();

    const softLiquidationEventInfo: SoftLiquidationEventInfo = {
      date: date,
      timestamp: info.timestamp,
      priceOracle: Number(info.priceOracle.toFixed(10)),
      currentPrice: Number(info.currentPrice.toFixed(10)),
      txHash: event.transactionHash,
      marketName: market.collateral_token.symbol,
      liquidator: event.returnValues.buyer,
      block: event.blockNumber,
    };

    return softLiquidationEventInfo;

    // return softLiquidationEventInfo;
  } catch (error) {
    console.error('Error processing soft liquidation event:', error);
    return null; // Return null in case of failure
  }
}

async function getMintMarketOraclePrice(market: MarketData, blockNumber: number): Promise<any> {
  const llamma = await getLlammaContract(market.llamma);
  const price_oracle = (await web3Call(llamma, 'price_oracle', [], blockNumber)) / 1e18;
  return price_oracle;
}

async function getPAndOracleEveryBlock(market: MarketData) {
  const blockInterval = 1; // 1 = Every block
  const currentBlock = await getCurrentBlockNumber();
  if (!currentBlock) return;

  const blocksPerMinute = 5;
  const blocksPerDay = blocksPerMinute * 60 * 24;
  const blocksPerMonth = blocksPerDay * 30;
  const startBlock = currentBlock - blocksPerMonth * 3;
  // const startBlock = currentBlock - blocksPerMinute * 30;

  // Create an array of block numbers
  const blockNumbers = [];
  for (let block = startBlock; block <= currentBlock; block += blockInterval) {
    blockNumbers.push(block);
  }

  const llamma = await getLlammaContract(market.llamma);

  // Function to process a single block
  async function processBlock(blockNumber: number) {
    try {
      const price_oracle = (await web3Call(llamma, 'price_oracle', [], blockNumber)) / 1e18;
      const get_p = (await web3Call(llamma, 'get_p', [], blockNumber)) / 1e18;
      return { blockNumber, price_oracle, get_p };
    } catch (error) {
      console.error('Error processing block:', blockNumber, error);
      return null; // Return null on error to handle gracefully
    }
  }

  // Chunk processing logic
  const chunkSize = 11;
  const totalChunks = Math.ceil(blockNumbers.length / chunkSize);
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < blockNumbers.length; i += chunkSize) {
    const chunk = blockNumbers.slice(i, i + chunkSize);
    const currentChunk = Math.floor(i / chunkSize);

    // Only log every 50th chunk
    if (currentChunk % 50 === 0) {
      console.log(`Processing chunk: ${chunk[0]} to ${chunk[chunk.length - 1]}`);
    }

    const chunkResults = await Promise.all(chunk.map(processBlock));
    results.push(...chunkResults.filter((result) => result !== null));

    // Calculate and display progress
    const progress = ((currentChunk + 1) / totalChunks) * 100;
    const elapsedTime = Date.now() - startTime;
    const estimatedTotalTime = (elapsedTime / progress) * 100;
    const remainingTime = estimatedTotalTime - elapsedTime;
    const remainingMinutes = Math.ceil(remainingTime / 60000);

    if (currentChunk % 50 === 0) {
      console.log(`Progress: ${progress.toFixed(1)}% - ETA: ${remainingMinutes} minutes`);
    }
  }

  // console.log('Final Results:', results);
  // Save results to JSON file
  const filePath = path.join(process.cwd(), 'price_oracle_results.json');
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Price oracle results saved to ${filePath}`);
  return results;
}

async function getFullY(
  market: MarketData,
  users: string[],
  blockNumber: number,
  collatTokenDecimals: number
): Promise<number> {
  const multicall = new Multicall({ web3Instance: WEB3_HTTP_PROVIDER, tryAggregate: true });
  const abi = getMintMarketLlammaAbi();
  const batchSize = 500; // Adjust batch size as needed
  let fullY = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const chunk = users.slice(i, i + batchSize);
    const calls: ContractCallContext[] = chunk.map((user, index) => ({
      reference: `get_y_up-${index}`,
      contractAddress: market.llamma,
      abi,
      calls: [
        {
          reference: `call-${user}`,
          methodName: 'get_y_up',
          methodParameters: [user],
        },
      ],
    }));

    try {
      const results: ContractCallResults = await multicall.call(calls, {
        blockNumber: Number(blockNumber).toString(),
      });

      chunk.forEach((user, index) => {
        const result = results.results[`get_y_up-${index}`]?.callsReturnContext[0]?.returnValues?.[0];
        if (result) {
          const decimalValue = parseInt(result.hex, 16);
          fullY += decimalValue / 10 ** collatTokenDecimals;
        }
      });
    } catch (error) {
      console.error('Error in multicall execution:', error);
    }
  }

  return fullY;
}

interface UserInteraction {
  user: string;
  first: string;
  last: string;
}

interface MarketUserResponse {
  page: number;
  per_page: number;
  count: number;
  data: UserInteraction[];
}

async function getAllMintMarketUserEverCurvePrices(market: MarketData, blockNumber: number): Promise<string[]> {
  const baseUrl = `https://prices.curve.fi/v1/crvusd/users/ethereum/${market.address}/users`;
  const perPage = 400; // Max items per page
  let page = 1;
  let users: string[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const url = `${baseUrl}?page=${page}&per_page=${perPage}`;
      const response = await fetch(url, { headers: { accept: 'application/json' } });

      if (!response.ok) {
        throw new Error(`Failed to fetch users for market ${market}: ${response.statusText}`);
      }

      const result = (await response.json()) as MarketUserResponse;
      users.push(...result.data.map((interaction) => interaction.user));

      // Check if there are more pages
      hasMore = result.data.length === perPage;
      page++;
    }
  } catch (error) {
    console.error(`Error fetching mint market users for market ${market}:`, error);
  }

  return users;
}

async function getAllMintMarketUserEver(market: MarketData, blockNumber: number): Promise<string[]> {
  // Multicall setup
  const multicall = new Multicall({ web3Instance: WEB3_HTTP_PROVIDER, tryAggregate: true });

  const batchSize = 500;
  let startIndex = 0;
  const addresses: string[] = [];
  let shouldBreak = false;

  const abi = getMintMarketControllerAbi();

  while (!shouldBreak) {
    const calls: ContractCallContext[] = [];

    for (let i = startIndex; i < startIndex + batchSize; i++) {
      calls.push({
        reference: `loans-${i}`,
        contractAddress: market.address,
        abi: abi,
        calls: [
          {
            reference: `call-${i}`,
            methodName: 'loans',
            methodParameters: [i],
          },
        ],
      });
    }

    // Execute multicall
    try {
      const results: ContractCallResults = await multicall.call(calls, {
        blockNumber: Number(blockNumber).toString(),
      });

      for (let i = 0; i < batchSize; i++) {
        const loanResult = results.results[`loans-${startIndex + i}`]?.callsReturnContext[0];
        const userAddress = loanResult?.returnValues?.[0];

        if (!userAddress || userAddress === '0x0000000000000000000000000000000000000000') {
          shouldBreak = true;
          break;
        }

        addresses.push(userAddress);
      }

      startIndex += batchSize;
    } catch (error) {
      console.error('Error in multicall execution:', error);
      shouldBreak = true;
    }
  }

  // Remove duplicates
  return [...new Set(addresses)];
}

async function filterForSL(market: MarketData, addresses: string[], blockNumber: number): Promise<string[]> {
  const multicall = new Multicall({ web3Instance: WEB3_HTTP_PROVIDER, tryAggregate: true });
  const abi = getMintMarketControllerAbi();
  const usersInSL: string[] = [];
  const batchSize = 500; // Adjust batch size as needed

  for (let i = 0; i < addresses.length; i += batchSize) {
    const chunk = addresses.slice(i, i + batchSize);
    const calls: ContractCallContext[] = chunk.map((address, index) => ({
      reference: `userState-${index}`,
      contractAddress: market.address,
      abi,
      calls: [
        {
          reference: `call-${address}`,
          methodName: 'user_state',
          methodParameters: [address],
        },
      ],
    }));

    try {
      const results: ContractCallResults = await multicall.call(calls, {
        blockNumber: Number(blockNumber).toString(),
      });

      chunk.forEach((address, index) => {
        const userState = results.results[`userState-${index}`]?.callsReturnContext[0]?.returnValues;
        const collateral = parseInt(userState[0].hex, 16);
        const debt = parseInt(userState[1].hex, 16);
        if (userState && collateral > 0 && debt > 0) {
          usersInSL.push(address);
        }
      });
    } catch (error) {
      console.error('Error in multicall execution:', error);
    }
  }

  return usersInSL;
}

async function getAllMintMarketUserInSL(
  market: MarketData,
  blockNumber: number,
  collatTokenDecimals: number
): Promise<number | null> {
  try {
    const allUsersEver = await getAllMintMarketUserEver(market, blockNumber);
    const allUsersInSL = await filterForSL(market, allUsersEver, blockNumber);
    const fullYBefore = await getFullY(market, allUsersInSL, blockNumber, collatTokenDecimals);
    const fullYAfter = await getFullY(market, allUsersInSL, blockNumber + 1, collatTokenDecimals);
    const softLiquidatedCollatAmount = fullYBefore - fullYAfter;
    const oraclePrice = await getMintMarketOraclePrice(market, blockNumber);
    const usdEquivalent = softLiquidatedCollatAmount * oraclePrice;

    return usdEquivalent;
  } catch (err) {
    console.log('err in getAllMintMarketUserInSL:', err);
    return null;
  }
}

async function processSingleMarket(market: MarketData) {
  // FULL GET_P ORACLE_PRICE
  if (market.address.toLowerCase() !== '0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635'.toLowerCase()) return; // => WETH only
  //  if (market.address.toLowerCase() !== '0x4e59541306910aD6dC1daC0AC9dFB29bD9F15c67'.toLowerCase()) return; // => WBTC only
  // await getPAndOracleEveryBlock(market);

  // BAND STUFF JSON
  // const contract = await getLlammaContract(market.llamma);
  // const startBlock = 21026133;
  // const endBlock = 21249333;

  // const chunkSize = 10;
  // const dumpSize = 1000;
  // const fileName = 'band_data.json';

  // const totalBlocks = endBlock - startBlock;
  // let data = [];

  // // Load existing data if file exists
  // try {
  //   if (fs.existsSync(fileName)) {
  //     data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
  //     console.log(`Loaded ${data.length} existing records`);
  //   }
  // } catch (err) {
  //   console.log('No existing file found or error reading file');
  // }

  // for (let i = startBlock; i < endBlock; i += chunkSize) {
  //   const chunk = [];
  //   for (let j = 0; j < chunkSize && i + j < endBlock; j++) {
  //     const blockNumber = i + j;
  //     const activeBand = await web3Call(contract, 'active_band', [], blockNumber);
  //     chunk.push(
  //       Promise.all([
  //         web3Call(contract, 'bands_x', [activeBand], blockNumber),
  //         web3Call(contract, 'bands_y', [activeBand], blockNumber),
  //         getMintMarketOraclePrice(market, blockNumber),
  //       ]).then(([bandsX, bandsY, oraclePrice]) => {
  //         const amountBorrowableToken = Number(bandsX) / 1e18;
  //         const amountCollatToken = Number(bandsY) / 1e18;
  //         const amountCollatTokenInUsd = oraclePrice * amountCollatToken;
  //         const amountFullInBandInUsd = amountCollatTokenInUsd + amountBorrowableToken;

  //         return {
  //           blockNumber,
  //           band: Number(activeBand),
  //           amountBorrowableToken,
  //           amountCollatToken,
  //           oraclePrice,
  //           amountCollatTokenInUsd,
  //           amountFullInBandInUsd,
  //         };
  //       })
  //     );
  //   }

  //   const results = await Promise.all(chunk);
  //   data.push(...results);

  //   const progress = (((i - startBlock) / totalBlocks) * 100).toFixed(2);
  //   console.log(`Progress: ${progress}% (Block ${i} of ${endBlock})`);

  //   // Dump to file every dumpSize blocks
  //   if (data.length >= dumpSize || i + chunkSize >= endBlock) {
  //     const existingData = fs.existsSync(fileName) ? JSON.parse(fs.readFileSync(fileName, 'utf8')) : [];
  //     const combinedData = [...existingData, ...data];
  //     fs.writeFileSync(fileName, JSON.stringify(combinedData, null, 2));
  //     console.log(`Data dumped to ${fileName} at block ${i}. Total records: ${combinedData.length}`);
  //     data = []; // Clear the temporary array after dumping
  //   }
  // }

  // console.log('Processing completed');
  // process.exit();

  // EVENT BASED
  // const softLiquidationEvents = await fetchSoftLiquidationEventsForMarket(market);
  // console.log('softLiquidationEvents', softLiquidationEvents.length);

  // console.time('Full');

  // const collatTokenAddress = market.collateral_token.address;
  // const collatTokenDecimals = await getTokenDecimalsFromChain(collatTokenAddress);

  // if (!collatTokenDecimals) {
  //   console.log('Could not get collateral token decimals');
  //   return;
  // }

  // for (const [index, event] of softLiquidationEvents.entries()) {
  //   console.log(`Processing event ${index + 1}/${softLiquidationEvents.length}`);
  //   // events.push(event);

  //   // if (event.blockNumber !== 20554845) continue; // simple case, just 1 swap.
  //   // if (event.blockNumber !== 20567743) continue; // simple case, just 1 swap.

  //   const blockNumber = event.blockNumber;

  //   const usdEquivalent = await getAllMintMarketUserInSL(market, blockNumber, collatTokenDecimals);
  //   if (!usdEquivalent) continue;

  //   getYUpData.push({
  //     usdEquivalent,
  //     blockNumber: event.blockNumber,
  //     transactionHash: event.transactionHash,
  //     buyer: event.returnValues.buyer,
  //   });

  //   console.log(usdEquivalent, event.blockNumber, event.transactionHash, event.returnValues.buyer);
  //   // console.log('event', event);
  //   // const arbRes = await processSingleSoftLiquidationEvent(event, market);
  //   // if (arbRes) {
  //   //   allArbResults.push(arbRes);
  //   // }
  //   // const res = await processSingleSoftLiquidationEvent(event, market);
  //   // if (res) {
  //   //   allResults.push(res);
  //   // }
  //   // console.log('arbRes', arbRes);
  //   // console.log('done');
  //   // process.exit();
  // }
  // console.timeEnd('Full');
}

export async function startMintMarketsRisk() {
  // console.time('Full');
  const marketsResponse = await fetchMarkets();
  const markets = marketsResponse.data;

  for (const market of markets) {
    // console.log(market);
    await processSingleMarket(market);
  }

  // Save all results to a JSON file
  const filePath = path.join(process.cwd(), 'soft_liquidation_user_losses.json');
  fs.writeFileSync(filePath, JSON.stringify(getYUpData, null, 2), 'utf-8');
  console.log(`Results saved to ${filePath}`);
  // console.timeEnd('Full');
}
