import { getLlammaContract } from '../../crvUSD/mint/Contracts.js';
import { RiskMintMarketInfo } from '../../models/RiskMintMarkets.js';
import { getCurrentBlockNumberWithRetry, web3Call } from '../web3Calls/generic.js';
import { Op } from 'sequelize';

interface TokenInfo {
  symbol: string;
  address: string;
}

interface MarketData {
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

async function getUniqueBlockNumbers(entries: RiskMintMarketInfo[] | null): Promise<RiskMintMarketInfo[]> {
  if (!entries || entries.length === 0) {
    console.log('No entries provided to filter.');
    return [];
  }

  const seenBlockNumbers = new Set<number>(); // Track block numbers already added
  const uniqueEntries: RiskMintMarketInfo[] = [];

  for (const entry of entries) {
    if (!seenBlockNumbers.has(entry.blockNumber)) {
      seenBlockNumbers.add(entry.blockNumber);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries;
}

interface SimplifiedRiskMintMarketInfo {
  controller: string;
  blockNumber: number;
  band: number;
  amountBorrowableToken: string;
  amountCollatToken: string;
  oraclePrice: string;
  get_p: string;
  amountCollatTokenInUsd: string;
  amountFullInBandInUsd: string;
}

function simplifyRiskMintMarketInfo(entries: RiskMintMarketInfo[]): SimplifiedRiskMintMarketInfo[] {
  return entries.map((entry) => ({
    controller: entry.dataValues.controller,
    blockNumber: entry.dataValues.blockNumber,
    band: entry.dataValues.band,
    amountBorrowableToken: entry.dataValues.amountBorrowableToken,
    amountCollatToken: entry.dataValues.amountCollatToken,
    oraclePrice: entry.dataValues.oraclePrice,
    get_p: entry.dataValues.get_p,
    amountCollatTokenInUsd: entry.dataValues.amountCollatTokenInUsd,
    amountFullInBandInUsd: entry.dataValues.amountFullInBandInUsd,
  }));
}

export async function getMintMarketRiskInfo(controllerAddress: string): Promise<SimplifiedRiskMintMarketInfo[] | null> {
  const SECONDS_IN_3_MONTHS = 90 * 24 * 60 * 60; // 3 months in seconds
  const BLOCK_TIME = 12; // Average block time in seconds
  const blocksIn3Months = Math.floor(SECONDS_IN_3_MONTHS / BLOCK_TIME); // Number of blocks in 3 months

  try {
    // Get the current block number
    const nowBlock = await getCurrentBlockNumberWithRetry();
    if (!nowBlock) {
      console.log('Failed to fetch the current block number');
      return null;
    }

    // Calculate the starting block for the 3-month range
    const startBlock = nowBlock - blocksIn3Months;

    // Query entries from the database
    const entries = await RiskMintMarketInfo.findAll({
      where: {
        controller: controllerAddress,
        blockNumber: {
          [Op.gte]: startBlock, // Only include entries from `startBlock` onwards
        },
      },
      order: [['blockNumber', 'DESC']], // Order by block number in descending order
    });

    return simplifyRiskMintMarketInfo(await getUniqueBlockNumbers(entries));
  } catch (error) {
    console.error(`Error fetching entries for controller ${controllerAddress}:`, error);
    return null;
  }
}

async function fetchMarkets(): Promise<MarketResponse | null> {
  const url = 'https://prices.curve.fi/v1/crvusd/markets/ethereum?fetch_on_chain=false&page=1&per_page=100';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch data: ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as MarketResponse;
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return null;
  }
}

async function getMostRecentBlockNumberInRiskTable(controllerAddress: string): Promise<number | null> {
  try {
    // Query the BorrowableData table for the highest block number associated with the market address
    const recentBlock = await RiskMintMarketInfo.findOne({
      where: { controller: controllerAddress }, // Match the controller address
      order: [['blockNumber', 'DESC']], // Sort in descending order to get the most recent block number
      attributes: ['blockNumber'], // Only fetch the blockNumber field
    });

    // If a record is found, return the block number
    return recentBlock ? recentBlock.blockNumber : null;
  } catch (error) {
    console.error(`Error retrieving most recent block number for market ${controllerAddress}:`, error);
    return null; // Return null on error
  }
}

async function getMintMarketOraclePrice(market: MarketData, blockNumber: number): Promise<any> {
  const llamma = await getLlammaContract(market.llamma);
  const price_oracle = (await web3Call(llamma, 'price_oracle', [], blockNumber)) / 1e18;
  return price_oracle;
}

async function writeResultsToDatabase(
  results: ({
    controller: string;
    blockNumber: number;
    band: number;
    amountBorrowableToken: number;
    amountCollatToken: number;
    oraclePrice: any;
    get_p: any;
    amountCollatTokenInUsd: number;
    amountFullInBandInUsd: number;
  } | null)[]
): Promise<void> {
  try {
    // Filter out null entries
    const validResults = results.filter((result): result is Exclude<typeof result, null> => result !== null);

    if (validResults.length === 0) {
      console.log('No valid results to insert into the database.');
      return;
    }

    // Remove duplicates based on blockNumber and controller
    const uniqueResults = Array.from(
      new Map(validResults.map((item) => [`${item.blockNumber}-${item.controller}`, item])).values()
    );

    // Bulk insert with update on duplicate
    await RiskMintMarketInfo.bulkCreate(uniqueResults, {
      updateOnDuplicate: [
        'band',
        'amountBorrowableToken',
        'amountCollatToken',
        'oraclePrice',
        ' get_p',
        'amountCollatTokenInUsd',
        'amountFullInBandInUsd',
      ],
    });
  } catch (error) {
    console.error('Error writing results to the database in writeResultsToDatabase:', error);
  }
}

async function fetchOnChain(
  chunkSize: number,
  i: number,
  blockSkipper: number,
  nowBlock: number,
  contract: any,
  market: any
) {
  const chunkPromises = Array.from({ length: chunkSize }, (_, index) => {
    const blockNumber = i + index * blockSkipper;
    if (blockNumber > nowBlock!) return null;

    return web3Call(contract, 'active_band', [], blockNumber)
      .then((activeBand) =>
        Promise.all([
          web3Call(contract, 'bands_x', [activeBand], blockNumber),
          web3Call(contract, 'bands_y', [activeBand], blockNumber),
          getMintMarketOraclePrice(market, blockNumber),
          web3Call(contract, 'get_p', [], blockNumber),
        ]).then(([bandsX, bandsY, oraclePrice, get_p_raw]) => {
          const amountBorrowableToken = Number(bandsX) / 1e18;
          const amountCollatToken = Number(bandsY) / 1e18;
          const get_p = Number(get_p_raw) / 1e18;
          const amountCollatTokenInUsd = oraclePrice * amountCollatToken;
          const amountFullInBandInUsd = amountCollatTokenInUsd + amountBorrowableToken;

          return {
            controller: market.address,
            blockNumber,
            band: Number(activeBand),
            amountBorrowableToken,
            amountCollatToken,
            oraclePrice,
            get_p,
            amountCollatTokenInUsd,
            amountFullInBandInUsd,
          };
        })
      )
      .catch((error) => {
        console.error(`Error processing block ${blockNumber}:`, error);
        return null;
      });
  }).filter((promise) => promise !== null);

  const results = await Promise.all(chunkPromises);
  return results;
}

async function processSingleMarket(market: MarketData) {
  if (market.address === '0x8472A9A7632b173c8Cf3a86D3afec50c35548e76') return;

  const mostRecentBlockNumber = await getMostRecentBlockNumberInRiskTable(market.address);

  let nowBlock = await getCurrentBlockNumberWithRetry();
  if (!nowBlock) return;

  const MIN_DAYS_IN_DB = 90;
  const minBlockSpan = MIN_DAYS_IN_DB * 24 * 60 * 5; // ~5 blocks per minute
  const blockSkipper = 25; // Fetch every 25th block
  const chunkSize = 10; // Process 10 blocks in parallel

  let startBlock = nowBlock - minBlockSpan;
  if (mostRecentBlockNumber && mostRecentBlockNumber > startBlock) startBlock = mostRecentBlockNumber + blockSkipper; // continues fetching from correct block

  const contract = await getLlammaContract(market.llamma);

  for (let i = startBlock; i <= nowBlock; i += chunkSize * blockSkipper) {
    let retryCounter = 0;
    let results: any[] = [];

    do {
      results = await fetchOnChain(chunkSize, i, blockSkipper, nowBlock, contract, market);

      // Check if there are any invalid values in the results
      const hasInvalidValues = results.some(
        (result) =>
          !result ||
          Object.values(result).some(
            (value) => value === null || value === undefined || (typeof value === 'number' && isNaN(value))
          )
      );

      if (!hasInvalidValues) {
        // If all results are valid, exit the loop
        break;
      }

      retryCounter++;
      console.warn(`Invalid results detected (NaN, null, undefined). Retry attempt ${retryCounter} in 1 second...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Clear results array before next retry
      results = [];
    } while (retryCounter < 5);

    if (retryCounter === 5) {
      console.log('Max retries reached. Unable to fetch valid results.');
      return;
    }

    await writeResultsToDatabase(results);

    console.log(`Mint-Market: ${market.collateral_token.symbol} | Blocks left: ${nowBlock - i}`);

    nowBlock = await getCurrentBlockNumberWithRetry(); // updating the latest block, so there are no gaps
    if (!nowBlock) return;
  }
}

export async function updateMintMarketForMevScoring() {
  const marketsResponse = await fetchMarkets();
  if (!marketsResponse) return;
  const markets = marketsResponse.data;

  for (const market of markets) {
    await processSingleMarket(market);
  }
  console.log('First Mint Market Risk Iteration Completed!');

  setInterval(
    async () => {
      try {
        const marketsResponse = await fetchMarkets();
        if (!marketsResponse) return;
        const markets = marketsResponse.data;

        for (const market of markets) {
          console.time();
          await processSingleMarket(market);
          console.timeEnd();
        }
        console.log('Mint Market Risk Iteration Completed!');
      } catch (error) {
        console.error('Error processing markets:', error);
      }
    },
    5 * 60 * 1000
  ); // Run every 5 minutes
}
