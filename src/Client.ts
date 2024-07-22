import { io, Socket } from 'socket.io-client';
import { topBestPerformingLabels, topWorstPerformingLabels } from './utils/helperFunctions/Client.js';
import {
  SandwichDetail,
  SandwichTableContent,
} from './utils/postgresTables/readFunctions/SandwichDetailEnrichments.js';
import {
  ArbBotLeaderBoardbyTxCount,
  AtomicArbTableContent,
  CexDexArbTableContent,
  DurationInput,
  EnrichedTransactionDetail,
  IntervalInput,
  TransactionDetailsForAtomicArbs,
} from './utils/Interfaces.js';
import { AggregatedVolumeData } from './utils/api/queries/AggregatedMevVolume.js';
import fs from 'fs';

// Replace with "wss://api.curvemonitor.com" for production
// const url = 'http://localhost:443';
const url = 'wss://api.curvemonitor.com';

/**
 *
 * Find the Endpoint-Overview at the bottom of this file.
 *
 */

// you say: Ping, I say: Pong. Ping? Pong!
export function startPingClient(socket: Socket) {
  // Ping the server every 500ms
  setInterval(() => {
    socket.emit('Ping');
  }, 500);

  socket.on('Pong', () => {
    console.log('Received pong from the server.');
  });

  handleErrors(socket, '/main');
}

/**
 * Counts Labels for all Sandwiches for all Pools in absolute terms.
 * (i.e., the total number of times they occurred in all sandwiches, not relative to any other measure)
 *
 * Labels Ranking Response:
 *
 * The response from the labels ranking is an array of objects. Each object represents a different
 * label and contains the following properties:
 *
 *  - `address`: The Ethereum address associated with the label. This is a hexadecimal string.
 *  - `label`: A human-readable name for the address. This string describes the entity or function
 *    associated with the Ethereum address.
 *  - `occurrences`: The absolute number of times this address has been seen or referenced in sandwich transactions.
 *
 * Example response:
 *
 * [
 *   {
 *     address: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f',
 *     label: 'Curve.fi: Swap Router',
 *     occurrences: 76
 *   },
 *   {
 *     address: '0x1111111254EEB25477B68fb85Ed929f73A960582',
 *     label: '1inch v5: Aggregation Router',
 *     occurrences: 48
 *   },
 *   {
 *     address: '0xA2F987A546D4CD1c607Ee8141276876C26b72Bdf',
 *     label: 'Anchor Protocol: AnchorVault',
 *     occurrences: 35
 *   },
 *   ...
 * ]
 */
export function startAbsoluteLabelsRankingClient(socket: Socket) {
  // request for absolute labels ranking
  socket.emit('getAbsoluteLabelsRanking');

  socket.on('labelsRanking', (labelsRanking: LabelRankingShort[]) => {
    console.log('Received absolute labels ranking: ', labelsRanking);
    console.log('Number of labels:', labelsRanking.length);
  });

  handleErrors(socket, '/main');
}

export interface LabelRankingShort {
  address: string;
  label: string;
  occurrences: number;
}

/**
 * same as startAbsoluteLabelsRankingClient with an additional field numOfAllTx
 * Example:
 * {
    address: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    label: 'Paraswap v5: Augustus Swapper Mainnet',
    occurrences: 14,
    numOfAllTx: 1847
  }
 */
export function startSandwichLabelOccurrencesClient(socket: Socket) {
  // request for sandwich label occurrences
  socket.emit('getSandwichLabelOccurrences');

  socket.on('sandwichLabelOccurrences', (sandwichLabelOccurrences: LabelRankingExtended[]) => {
    // console.log("Received sandwich label occurrences: ", labelsOccurrence);
    // console.log("Number of labels:", labelsOccurrence.length);

    const bestPerforming = topBestPerformingLabels(sandwichLabelOccurrences);
    console.log('Best performing labels: ', bestPerforming);

    const worstPerforming = topWorstPerformingLabels(sandwichLabelOccurrences);
    console.log('Worst performing labels: ', worstPerforming);
  });

  handleErrors(socket, '/main');
}
export interface LabelRankingExtended {
  address: string;
  label: string;
  occurrences: number;
  numOfAllTx: number;
}

// Convert user input into pool-suggestions, returns ranked pool suggestions (Pool-Name and Pool-Address)
export function startUserSearchClient(socket: Socket, userInput: string) {
  socket.emit('getUserSearchResult', userInput);

  socket.on('userSearchResult', (userSearchResult: UserSearchResult[]) => {
    console.log('Received user search result: ', userSearchResult);
  });

  handleErrors(socket, '/main');
}

export interface UserSearchResult {
  address: string;
  name: string | null;
}

/**
 * Example for enrichedSandwich
 * {
  frontrun: {
    tx_id: 101421,
    pool_id: 28,
    event_id: 142867,
    tx_hash: '0x54082d12f8ab922607c42433ecff63dfb9f6c11a92e7b0160616bd8b917e20e5',
    block_number: 17629377,
    block_unixtime: '1688580647',
    transaction_type: 'swap',
    called_contract_by_user: '0xE8c060F8052E07423f71D445277c61AC5138A2e5',
    trader: '0xE8c060F8052E07423f71D445277c61AC5138A2e5',
    tx_position: 4,
    coins_leaving_wallet: [
      {
        coin_id: 28,
        amount: '718.733090248213600',
        name: '3Crv',
        address: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
      }
    ],
    coins_entering_wallet: [
      {
        coin_id: 259,
        amount: '152984.553881940930000',
        name: 'UST',
        address: '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD'
      }
    ]
  },
  center: [
    {
      tx_id: 101416,
      pool_id: 28,
      event_id: 142868,
      tx_hash: '0x67e14a5ccde90aabc5f65349c325c7c61d76be79c3b190073f5ec8b421e1723a',
      block_number: 17629377,
      block_unixtime: '1688580647',
      transaction_type: 'swap',
      called_contract_by_user: '0xeCb456EA5365865EbAb8a2661B0c503410e9B347',
      trader: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f',
      tx_position: 5,
      coins_leaving_wallet: [
        {
          coin_id: 28,
          amount: '9.656041053186470',
          name: '3Crv',
          address: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
        }
      ],
      coins_entering_wallet: [
        {
          coin_id: 259,
          amount: '6099.199873959161000',
          name: 'UST',
          address: '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD'
        }
      ]
    }
  ],
  backrun: {
    tx_id: 101423,
    pool_id: 28,
    event_id: 142869,
    tx_hash: '0xbdab0526dd736cd1037b1a5bac66ae91ec8b462a04f6070835601ae7f34fca9e',
    block_number: 17629377,
    block_unixtime: '1688580647',
    transaction_type: 'swap',
    called_contract_by_user: '0xE8c060F8052E07423f71D445277c61AC5138A2e5',
    trader: '0xE8c060F8052E07423f71D445277c61AC5138A2e5',
    tx_position: 6,
    coins_leaving_wallet: [
      {
        coin_id: 259,
        amount: '158187.842888238640000',
        name: 'UST',
        address: '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD'
      }
    ],
    coins_entering_wallet: [
      {
        coin_id: 28,
        amount: '718.733090248213600',
        name: '3Crv',
        address: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
      }
    ]
  },
  user_losses_details: [
    {
      unit: '3Crv',
      amount: 63.505298732480725,
      lossInPercentage: 86.80171647830026
    }
  ],
  label: 'Curve.fi: Pool Owner',
  lossInUsd: 53.505298732480725
}
 */
export function startNewSandwichClient(socket: Socket) {
  socket.on('NewSandwich', (sandwichDetails: SandwichDetail) => {
    console.log('Received new sandwich');
    console.dir(sandwichDetails, { depth: null, colors: true });
  });

  socket.emit('connectToGeneralSandwichLivestream');

  handleErrors(socket, '/main');
}

// This function takes care of any connection or generic errors
function handleErrors(socket: Socket, endpoint: string) {
  socket.on('connect_error', (err: Error) => {
    console.log(`Connection Error on ${endpoint}: ${err}`);
  });

  socket.on('error', (err: Error) => {
    console.log(`Error on ${endpoint}: ${err}`);
  });
}

// returns a list/table, of all sandwiches, for all pools, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
// returns the total number of found sandwiches for the pool and time period
export function startFullSandwichTableClient(socket: Socket, timeDuration: string, page: number) {
  socket.emit('getFullSandwichTableContent', timeDuration, page);

  socket.on('fullSandwichTableContent', (fullTableContent: SandwichTableContent) => {
    console.log('Received full Sandwich-Table Content:');
    console.log('Data:', fullTableContent.data);
    console.log('Total Sandwiches:', fullTableContent.totalSandwiches);
  });

  handleErrors(socket, '/main');
}

// returns a list/table, of sandwiches in a given pool, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
// returns the total number of found sandwiches for the pool and time period
export function startPoolSpecificSandwichTable(
  socket: Socket,
  poolAddress: string,
  timeDuration: string,
  page: number
) {
  socket.emit('getPoolSpecificSandwichTable', poolAddress, timeDuration, page);

  socket.on('SandwichTableContentForPool', (fullTableContent: SandwichTableContent) => {
    console.log('Received Pool specific Sandwich-Table:');
    console.log('Data:', fullTableContent.data);
    console.log('Total Sandwiches:', fullTableContent.totalSandwiches);
  });

  handleErrors(socket, '/main');
}

// streams all tx in real-time
// mind the arrays for coins, since users can deposit multiple coins.
// also don't confuse leaving with entering like I did.
/*
Example:
{
  tx_id: 114395,
  pool_id: 15,
  event_id: 301896,
  tx_hash: '0x567ced0fd242f2aa048352f625461230205b2d864fada00a76a2ceeefdb9e01e',
  block_number: 17677694,
  block_unixtime: '1689167483',
  transaction_type: 'swap',
  called_contract_by_user: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f',
  trader: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f',
  tx_position: 121,
  coins_leaving_wallet: [
    {
      coin_id: 200,
      amount: '55.000000000000000',
      name: 'ETH',
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    }
  ],
  coins_entering_wallet: [
    {
      coin_id: 96,
      amount: '55.004610511990260',
      name: 'stETH',
      address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'
    }
  ],
  poolAddress: '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022',
  poolName: 'ETH/stETH'
}
*/
export function startNewGeneralTxClient(socket: Socket) {
  socket.on('NewGeneralTx', (enrichedTransaction: EnrichedTransactionDetail) => {
    console.log('Received new General Tx');
    console.dir(enrichedTransaction, { depth: null, colors: true });
  });

  socket.emit('connectToGeneralTxLivestream');

  handleErrors(socket, '/main');
}

// returns a list/table, of swaps/deposits/withdrawals in a given pool, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
export function startPoolSpecificTransactionTable(
  socket: Socket,
  poolAddress: string,
  timeDuration: string,
  page: number
) {
  socket.emit('getPoolSpecificTransactionTable', poolAddress, timeDuration, page);

  socket.on('TransactionTableContentForPool', (transactionTableContentForPool: EnrichedTransactionDetail[]) => {
    console.log('Received Pool specific Transaction-Table:');
    console.dir(transactionTableContentForPool, { depth: null, colors: true });
  });

  handleErrors(socket, '/main');
}

export function startPoolLabel(socket: Socket, poolAddress: string) {
  socket.emit('getPoolLabel', poolAddress);

  socket.on('poolLabel', (poolLabel: string) => {
    console.log(`Do something with ${poolLabel}`);
  });

  handleErrors(socket, '/main');
}

// connecting to atomic arb livestream:
export function startNewAtomicArbClient(socket: Socket) {
  socket.on('NewAtomicArb', (atomicArbDetails: TransactionDetailsForAtomicArbs) => {
    console.log('Received new Atomic Arb');
    console.dir(atomicArbDetails, { depth: null, colors: true });
  });

  socket.emit('connectToAtomicArbLivestream');

  handleErrors(socket, '/main');
}

/*
Example Response:
Data: [
  {
    tx_id: 4338552,
    pool_id: 687,
    event_id: 5387558,
    tx_hash: '0x66d717f0f06ccda8a5a5e1ae646dc078b0856c477406a6c8d41e6bd9c1ef0d92',
    block_number: 19833834,
    block_unixtime: '1715273939',
    transaction_type: 'swap',
    trader: '0x00000000009E50a7dDb7a7B0e2ee6604fd120E49',
    tx_position: 11,
    raw_fees: null,
    fee_usd: null,
    value_usd: null,
    createdAt: '2024-05-09T16:59:03.065Z',
    updatedAt: '2024-05-09T16:59:03.065Z',
    revenue: 19.93,
    gasInUsd: 19.51,
    gasInGwei: 8.164614414,
    netWin: 0.41,
    bribe: 0,
    totalCost: 19.51,
    blockBuilder: null,
    validatorPayOffUSD: null
  },
  {...},
  ...
]
Total Atomic Arbitrages: 458
*/
export function startFullAtomicArbTableClient(socket: Socket, timeDuration: string, page: number) {
  socket.emit('getFullAtomicArbTableContent', timeDuration, page);

  socket.on('fullAtomicArbTableContent', (fullTableContent: AtomicArbTableContent) => {
    console.log('Received full Atomic Arb-Table Content:');
    console.log('Data:', fullTableContent.data);
    console.log('Total Atomic Arbitrages:', fullTableContent.totalNumberOfAtomicArbs);
  });

  handleErrors(socket, '/main');
}

// *see info at startFullAtomicArbTableClient. Identical response, just for a specific pool.
export function startPoolSpecificAtomicArbTableClient(
  socket: Socket,
  poolAddress: string,
  timeDuration: string,
  page: number
) {
  socket.emit('getPoolSpecificAtomicArbTable', poolAddress, timeDuration, page);

  socket.on('poolSpecificAtomicArbTableContent', (atomicArbTableContentForPool: AtomicArbTableContent) => {
    console.log('Received Pool specific Atomic Arb-Table:');
    console.log('Data:', atomicArbTableContentForPool.data);
    console.log('Total Atomic Arbitrages:', atomicArbTableContentForPool.totalNumberOfAtomicArbs);
  });

  handleErrors(socket, '/main');
}

/*
Example Response:
*note: coin values in this example are made up, but structure is accurate. 
Received full CexDex Arb-Table Content:
Data: [
  {
    tx_id: 4385866,
    pool_id: 639,
    event_id: 5394281,
    tx_hash: '0x518640c442563a4d978fd619464d92e3d5a1762e1aa86d3daf32fc2e6ef0bb93',
    block_number: 19841117,
    block_unixtime: '1715361971',
    transaction_type: 'swap',
    called_contract_by_user: '0x51C72848c68a965f66FA7a88855F9f7784502a7F',
    trader: '0x867bDC57D1B071FE5A9F670Dd70b91E4269814D3',
    tx_position: 14,
    coins_leaving_wallet: [
      {
        coin_id: 200,
        amount: '55.000000000000000',
        name: 'ETH',
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
      }
    ],
    coins_entering_wallet: [
      {
        coin_id: 96,
        amount: '55.004610511990260',
        name: 'stETH',
        address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'
      }
    ],
    poolAddress: '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B',
      poolName: 'TricryptoUSDC',
      calledContractLabel: '0x51C72848c68a965f66FA7a88855F9f7784502a7F',
      from: '0x867bDC57D1B071FE5A9F670Dd70b91E4269814D3',
      calledContractInceptionTimestamp: '1692200591',
      isCalledContractFromCurve: false,
      gasInGwei: 24576345626,
      gasCostUSD: 15.701148521178318,
      bribeInUSD: 9.60234188155955
  },
  ...
]
Total CexDex Arbitrages: 926
*/
export function startFullCexDexArbTableClient(socket: Socket, timeDuration: string, page: number) {
  socket.emit('getFullCexDexArbTableContent', timeDuration, page);

  socket.on('fullCexDexArbTableContent', (fullTableContent: CexDexArbTableContent) => {
    console.log('Received full CexDex Arb-Table Content:');
    console.log('Data:', fullTableContent.data);
    console.log('Total CexDex Arbitrages:', fullTableContent.totalNumberOfCexDexArbs);
  });

  handleErrors(socket, '/main');
}

// *see info at startFullCexDexArbTableClient. Identical response, just for a specific pool.
export function startPoolSpecificCexDexArbTableClient(
  socket: Socket,
  poolAddress: string,
  timeDuration: string,
  page: number
) {
  socket.emit('getPoolSpecificCexDexArbTable', poolAddress, timeDuration, page);

  socket.on('poolSpecificCexDexArbTableContent', (cexDexArbTableContentForPool: CexDexArbTableContent) => {
    console.log('Received Pool specific CexDex Arb-Table:');
    console.log('Data:', cexDexArbTableContentForPool.data);
    console.log('Total CexDex Arbitrages:', cexDexArbTableContentForPool.totalNumberOfCexDexArbs);
  });
}

/*
Example Response:
Data: [
  {
    contractaddress: '0x00000000009E50a7dDb7a7B0e2ee6604fd120E49',
    txcount: '389'
  },
  {
    contractaddress: '0x64545160d28Fd0E309277C02D6d73b3923Cc4bFA',
    txcount: '35'
  },
  {
    contractaddress: '0xbb0f4a10Cc49927572E8ea951CB3b9e5A1F6113d',
    txcount: '28'
  },
  ...
]
*/
export function startAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(
  socket: Socket,
  poolAddress: string,
  timeDuration: string
) {
  socket.emit('getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration', poolAddress, timeDuration);

  socket.on(
    'AtomicArbBotLeaderBoardByTxCountForPoolAndDuration',
    (AtomicArbBotLeaderBoardByTxCountForPoolAndDuration: ArbBotLeaderBoardbyTxCount[]) => {
      console.log('Received Pool specific Atomic Arb-Table:');
      console.log('Data:', AtomicArbBotLeaderBoardByTxCountForPoolAndDuration);
    }
  );

  handleErrors(socket, '/main');
}

/*
Example Response:
Data: [
  {
    contractaddress: '0x5050e08626c499411B5D0E0b5AF0E83d3fD82EDF',
    txcount: '332'
  },
  {
    contractaddress: '0x000000000dFDe7deaF24138722987c9a6991e2D4',
    txcount: '10'
  },
  {
    contractaddress: '0x6F1cDbBb4d53d226CF4B917bF768B94acbAB6168',
    txcount: '9'
  },
  {
    contractaddress: '0xd42b0ECF8A9f8ba9Db7B0c989d73cf0Bd5f83b66',
    txcount: '2'
  },
  {
    contractaddress: '0x760762B30991A01F492E9ff067583a0C85d5768F',
    txcount: '1'
  }
]
*/
export function startCexDexBotLeaderBoardByTxCountForPoolAndDuration(
  socket: Socket,
  poolAddress: string,
  timeDuration: string
) {
  socket.emit('getCexDexArbBotLeaderBoardByTxCountForPoolAndDuration', poolAddress, timeDuration);

  socket.on(
    'CexDexArbBotLeaderBoardByTxCountForPoolAndDuration',
    (CexDexArbBotLeaderBoardByTxCountForPoolAndDuration: ArbBotLeaderBoardbyTxCount[]) => {
      console.log('Received Pool specific CexDex Arb-Table:');
      console.log('Data:', CexDexArbBotLeaderBoardByTxCountForPoolAndDuration);
    }
  );

  handleErrors(socket, '/main');
}

/*
Example Response:
Result: {
  data: [
    {
      interval_start: '2024-06-26T00:00:00.000Z',
      interval_start_unixtime: 1719360000,
      full_volume: 50756190,
      atomicArbVolume: 2095437,
      cexDexArbVolume: 1229048,
      sandwichVolume_LossWithin: 0,
      sandwichVolume_LossOutside: 0
    },
    {
      interval_start: '2024-06-27T00:00:00.000Z',
      interval_start_unixtime: 1719446400,
      full_volume: 53463163,
      atomicArbVolume: 2792455,
      cexDexArbVolume: 3087824,
      sandwichVolume_LossWithin: 0,
      sandwichVolume_LossOutside: 0
    },
    {
      interval_start: '2024-06-28T00:00:00.000Z',
      interval_start_unixtime: 1719532800,
      full_volume: 49660573,
      atomicArbVolume: 3570325,
      cexDexArbVolume: 958132,
      sandwichVolume_LossWithin: 0,
      sandwichVolume_LossOutside: 0
    },
    {
      interval_start: '2024-06-29T00:00:00.000Z',
      interval_start_unixtime: 1719619200,
      full_volume: 21178782,
      atomicArbVolume: 449907,
      cexDexArbVolume: 981858,
      sandwichVolume_LossWithin: 0,
      sandwichVolume_LossOutside: 547292
    },...
*/

// time duration examples: 1 week, 2 weeks, 1 hour, 1 year, 4 hours,...
// interval examples: {value: 1,unit: 'day',} or: {value: 2,unit: 'weeks',} (chunks the stuff in n weeks, or years, months, days, etc)
export function startPoolSpecificAggregatedMevVolumeClient(
  socket: Socket,
  poolAddress: string,
  timeDuration: DurationInput,
  timeInterval: IntervalInput
) {
  socket.emit('getPoolSpecificAggregatedMevVolume', poolAddress, timeDuration, timeInterval);

  socket.on('poolSpecificAggregatedMevVolume', (aggregatedMevVolumeForPool: AggregatedVolumeData[]) => {
    console.log('Received Pool specific Aggregated MEV Volume:');
    console.log('Result:', aggregatedMevVolumeForPool);
    fs.writeFileSync('fiddy.json', JSON.stringify(aggregatedMevVolumeForPool, null, 2));
  });
}

interface HealthDataPoint {
  timestamp: number;
  blockNumber: number;
  health: number;
}

interface MarketHealthData {
  marketName: string;
  userAddress: string;
  controllerAddress: string;
  healthDataPoints: HealthDataPoint[];
}

interface RealTimeMarketHealthData {
  marketName: string;
  userAddress: string;
  controllerAddress: string;
  health: number;
  timestamp: number;
}

/*
User requests real time data on health for lending.
Will ping the last 5 blocks, and ship that at once, and from there for each new block on message.
message contains info for all markets of user.

Example:
Received  New User Health Data: [
  {
    marketName: 'CRV-long',
    userAddress: '0xAAE2957078351c5b2fa93774329ceba4F4270011',
    controllerAddress: '0xEdA215b7666936DEd834f76f3fBC6F323295110A',
    health: 5.178899865334133,
    timestamp: 1719093231
  },
  {
    marketName: 'WETH-long',
    userAddress: '0xAAE2957078351c5b2fa93774329ceba4F4270011',
    controllerAddress: '0xaade9230AA9161880E13a38C83400d3D1995267b',
    health: 4.604163703072967,
    timestamp: 1719093231
  }
]
Received  New User Health Data: [
  {
    marketName: 'CRV-long',
    userAddress: '0xAAE2957078351c5b2fa93774329ceba4F4270011',
    controllerAddress: '0xEdA215b7666936DEd834f76f3fBC6F323295110A',
    health: 5.178899865334133,
    timestamp: 1719093243
  },
  {
    marketName: 'WETH-long',
    userAddress: '0xAAE2957078351c5b2fa93774329ceba4F4270011',
    controllerAddress: '0xaade9230AA9161880E13a38C83400d3D1995267b',
    health: 4.604163703072967,
    timestamp: 1719093243
  }
]
*/
export function startUserHealthLendingClient(socket: Socket, userAddress: string) {
  socket.emit('subscribeToUserHealthLendingStream', userAddress);

  socket.on('UserHealthData', (UserHealthData: MarketHealthData[]) => {
    console.log('Received Histo User Health Data:');
    console.dir(UserHealthData, { depth: null });
  });

  socket.on('RealTimeHealthUpdate', (realTimeHealthUpdate: RealTimeMarketHealthData[]) => {
    console.log('Received  New User Health Data:', realTimeHealthUpdate);
  });
}

export async function startTestClient() {
  const mainSocket = io(`${url}/main`);
  console.log(`connecting to ${url}/main`);

  mainSocket.on('connect', () => {
    console.log('connected');

    //  *************** Curve Lending ***************
    // startUserHealthLendingClient(mainSocket, '0xAAE2957078351c5b2fa93774329ceba4F4270011');

    //  *************** GENERAL STUFF ***************
    // startPingClient(mainSocket);
    // startUserSearchClient(mainSocket, 'crvu');
    // startPoolLabel(mainSocket, '0x6a6283aB6e31C2AeC3fA08697A8F806b740660b2');

    // *************** MEV **************************

    // *** aggregated ***

    // const tricryptoUSDC = '0x7f86bf177dd4f3494b841a37e810a34dd56c829b';
    // const poolAddress = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    // const duration = '4 days';
    // startPoolSpecificAggregatedMevVolumeClient(mainSocket, tricryptoUSDC, duration, {
    //   value: 1,
    //   unit: 'hour',
    // }); // (Pool Specific)

    // *** sammich ***

    startFullSandwichTableClient(mainSocket, 'full', 1); // (All Pools)
    // startAbsoluteLabelsRankingClient(mainSocket); // (All Pools)
    // startSandwichLabelOccurrencesClient(mainSocket); // (All Pools)

    // startNewSandwichClient(mainSocket); // (All Pools, live-feed)

    // startPoolSpecificSandwichTable(mainSocket, '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', '1 week', 1); // (Pool Specific)

    // *** atomic ***
    // startFullAtomicArbTableClient(mainSocket, '1 day', 1); // (All Pools)
    // startPoolSpecificAtomicArbTableClient(mainSocket, '0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14', '1 day', 1); // (Pool Specific)

    // startNewAtomicArbClient(mainSocket); // (All Pools, live-feed)

    // startAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(
    //   mainSocket,
    //   '0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72',
    //   '1 month'
    // ); // (Pool Specific)

    // *** cex ***
    // startFullCexDexArbTableClient(mainSocket, '1 day', 1); // (All Pools)
    // startPoolSpecificCexDexArbTableClient(mainSocket, '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', '1 year', 1); // (Pool Specific)

    // startCexDexBotLeaderBoardByTxCountForPoolAndDuration(
    //   mainSocket,
    //   '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
    //   '1 month'
    // );

    // *************** NOT MEV ********************

    // startNewGeneralTxClient(mainSocket); // (All Pools, live-feed)
    // startPoolSpecificTransactionTable(mainSocket, '0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14', '1 day', 3); // (Pool Specific)
  });
}
