import { io } from 'socket.io-client';
import { topBestPerformingLabels, topWorstPerformingLabels } from './utils/helperFunctions/Client.js';
// Replace with "wss://api.curvemonitor.com" for production
const url = 'http://localhost:443';
// const url = 'wss://api.curvemonitor.com';
/**
 *
 * Possible Usages of /main
 * emit("Ping")
 * emit("getAbsoluteLabelsRanking")
 * emit("getSandwichLabelOccurrences")
 * emit("getUserSearchResult", userInput)
 * emit("connectToGeneralSandwichLivestream");
 * emit("getFullSandwichTableContent", timeDuration, page);
 * emit("getPoolSpecificSandwichTable", poolAddress, timeDuration, page);
 * emit("connectToGeneralTxLivestream")
 * emit("getPoolSpecificTransactionTable", poolAddress, timeDuration, page)
 *
 */
// you say: Ping, I say: Pong. Ping? Pong!
export function startPingClient(socket) {
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
export function startAbsoluteLabelsRankingClient(socket) {
    // request for absolute labels ranking
    socket.emit('getAbsoluteLabelsRanking');
    socket.on('labelsRanking', (labelsRanking) => {
        console.log('Received absolute labels ranking: ', labelsRanking);
        console.log('Number of labels:', labelsRanking.length);
    });
    handleErrors(socket, '/main');
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
export function startSandwichLabelOccurrencesClient(socket) {
    // request for sandwich label occurrences
    socket.emit('getSandwichLabelOccurrences');
    socket.on('sandwichLabelOccurrences', (sandwichLabelOccurrences) => {
        // console.log("Received sandwich label occurrences: ", labelsOccurrence);
        // console.log("Number of labels:", labelsOccurrence.length);
        const bestPerforming = topBestPerformingLabels(sandwichLabelOccurrences);
        console.log('Best performing labels: ', bestPerforming);
        const worstPerforming = topWorstPerformingLabels(sandwichLabelOccurrences);
        console.log('Worst performing labels: ', worstPerforming);
    });
    handleErrors(socket, '/main');
}
// Convert user input into pool-suggestions, returns ranked pool suggestions (Pool-Name and Pool-Address)
export function startUserSearchClient(socket, userInput) {
    socket.emit('getUserSearchResult', userInput);
    socket.on('userSearchResult', (userSearchResult) => {
        console.log('Received user search result: ', userSearchResult);
    });
    handleErrors(socket, '/main');
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
export function startNewSandwichClient(socket) {
    socket.on('NewSandwich', (sandwichDetails) => {
        console.log('Received new sandwich');
        console.dir(sandwichDetails, { depth: null, colors: true });
    });
    socket.emit('connectToGeneralSandwichLivestream');
    handleErrors(socket, '/main');
}
// This function takes care of any connection or generic errors
function handleErrors(socket, endpoint) {
    socket.on('connect_error', (err) => {
        console.log(`Connection Error on ${endpoint}: ${err}`);
    });
    socket.on('error', (err) => {
        console.log(`Error on ${endpoint}: ${err}`);
    });
}
// returns a list/table, of all sandwiches, for all pools, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
// returns the total number of found sandwiches for the pool and time period
export function startFullSandwichTableClient(socket, timeDuration, page) {
    socket.emit('getFullSandwichTableContent', timeDuration, page);
    socket.on('fullSandwichTableContent', (fullTableContent) => {
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
export function startPoolSpecificSandwichTable(socket, poolAddress, timeDuration, page) {
    socket.emit('getPoolSpecificSandwichTable', poolAddress, timeDuration, page);
    socket.on('SandwichTableContentForPool', (fullTableContent) => {
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
export function startNewGeneralTxClient(socket) {
    socket.on('NewGeneralTx', (enrichedTransaction) => {
        console.log('Received new General Tx');
        console.dir(enrichedTransaction, { depth: null, colors: true });
    });
    socket.emit('connectToGeneralTxLivestream');
    handleErrors(socket, '/main');
}
// returns a list/table, of swaps/deposits/withdrawals in a given pool, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
export function startPoolSpecificTransactionTable(socket, poolAddress, timeDuration, page) {
    socket.emit('getPoolSpecificTransactionTable', poolAddress, timeDuration, page);
    socket.on('TransactionTableContentForPool', (transactionTableContentForPool) => {
        console.log('Received Pool specific Transaction-Table:');
        console.dir(transactionTableContentForPool, { depth: null, colors: true });
    });
    handleErrors(socket, '/main');
}
export function startPoolLabel(socket, poolAddress) {
    socket.emit('getPoolLabel', poolAddress);
    socket.on('poolLabel', (poolLabel) => {
        console.log(`Do something with ${poolLabel}`);
    });
    handleErrors(socket, '/main');
}
// connecting to atomic arb livestream:
export function startNewAtomicArbClient(socket) {
    socket.on('NewAtomicArb', (atomicArbDetails) => {
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
export function startFullAtomicArbTableClient(socket, timeDuration, page) {
    socket.emit('getFullAtomicArbTableContent', timeDuration, page);
    socket.on('fullAtomicArbTableContent', (fullTableContent) => {
        console.log('Received full Atomic Arb-Table Content:');
        console.log('Data:', fullTableContent.data);
        console.log('Total Atomic Arbitrages:', fullTableContent.totalNumberOfAtomicArbs);
    });
    handleErrors(socket, '/main');
}
// *see info at startFullAtomicArbTableClient. Identical response, just for a specific pool.
export function startPoolSpecificAtomicArbTableClient(socket, poolAddress, timeDuration, page) {
    socket.emit('getPoolSpecificAtomicArbTable', poolAddress, timeDuration, page);
    socket.on('poolSpecificAtomicArbTableContent', (atomicArbTableContentForPool) => {
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
    tx_id: 4348610,
    pool_id: 706,
    event_id: 5389195,
    tx_hash: '0xde4127aead4d4f426207af9face182d35ec00ba34ac93b45e8a759956a5ae57e',
    block_number: 19835557,
    block_unixtime: '1715294783',
    transaction_type: 'swap',
    called_contract_by_user: '0x6F1cDbBb4d53d226CF4B917bF768B94acbAB6168',
    trader: '0x152a04D9FdE2396C01c5F065a00BD5F6Edf5C88D',
    tx_position: 0,
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
    poolAddress: '0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14',
    poolName: 'TriCRV',
    calledContractLabel: '0x6F1cDbBb4d53d226CF4B917bF768B94acbAB6168',
    from: '0x152a04D9FdE2396C01c5F065a00BD5F6Edf5C88D',
    calledContractInceptionTimestamp: '1690212947',
    isCalledContractFromCurve: false,
    builder: '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',
    blockPayoutETH: 0.03227339798674891,
    blockPayoutUSD: 97.13324592071818,
    eoaNonce: 13985,
    gasInGwei: 25275312078,
    gasCostUSD: 15.448596432162443,
    bribeInUSD: 0
  },
  ...
]
Total CexDex Arbitrages: 926
*/
export function startFullCexDexArbTableClient(socket, timeDuration, page) {
    socket.emit('getFullCexDexArbTableContent', timeDuration, page);
    socket.on('fullCexDexArbTableContent', (fullTableContent) => {
        console.log('Received full CexDex Arb-Table Content:');
        console.log('Data:', fullTableContent.data);
        console.log('Total CexDex Arbitrages:', fullTableContent.totalNumberOfCexDexArbs);
    });
    handleErrors(socket, '/main');
}
// *see info at startFullCexDexArbTableClient. Identical response, just for a specific pool.
export function startPoolSpecificCexDexArbTableClient(socket, poolAddress, timeDuration, page) {
    socket.emit('getPoolSpecificCexDexArbTable', poolAddress, timeDuration, page);
    socket.on('poolSpecificCexDexArbTableContent', (cexDexArbTableContentForPool) => {
        console.log('Received Pool specific CexDex Arb-Table:');
        console.log('Data:', cexDexArbTableContentForPool.data);
        console.log('Total CexDex Arbitrages:', cexDexArbTableContentForPool.totalNumberOfCexDexArbs);
    });
}
export async function startTestClient() {
    const mainSocket = io(`${url}/main`);
    console.log(`connecting to ${url}/main`);
    mainSocket.on('connect', () => {
        console.log('connected');
        //  *************** GENERAL STUFF ***************
        // startPingClient(mainSocket);
        // startUserSearchClient(mainSocket, 'crvu');
        // startPoolLabel(mainSocket, "0x6a6283aB6e31C2AeC3fA08697A8F806b740660b2");
        // *************** MEV **************************
        // *** sammich ***
        // startFullSandwichTableClient(mainSocket, 'full', 1); // (All Pools)
        // startAbsoluteLabelsRankingClient(mainSocket); // (All Pools)
        // startSandwichLabelOccurrencesClient(mainSocket); // (All Pools)
        // startNewSandwichClient(mainSocket); // (All Pools, live-feed)
        // startPoolSpecificSandwichTable(mainSocket, '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', '1 week', 1); // (Pool Specific)
        // *** atomic ***
        // startFullAtomicArbTableClient(mainSocket, '1 day', 1); // (All Pools)
        // startPoolSpecificAtomicArbTableClient(mainSocket, '0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14', '1 day', 1); // (Pool Specific)
        // startNewAtomicArbClient(mainSocket); // (All Pools, live-feed)
        // *** cex ***
        // startFullCexDexArbTableClient(mainSocket, '1 day', 1); // (All Pools)
        startPoolSpecificCexDexArbTableClient(mainSocket, '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', '1 year', 1); // (Pool Specific)
        // *************** NOT MEV ********************
        // startNewGeneralTxClient(mainSocket); // (All Pools, live-feed)
        // startPoolSpecificTransactionTable(mainSocket, '0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14', '1 day', 3); // (Pool Specific)
    });
}
//# sourceMappingURL=Client.js.map