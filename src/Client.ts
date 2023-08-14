import { io, Socket } from "socket.io-client";
import { topBestPerformingLabels, topWorstPerformingLabels } from "./utils/helperFunctions/Client.js";
import { SandwichDetail } from "./utils/postgresTables/readFunctions/SandwichDetailEnrichments.js";
import { EnrichedTransactionDetail, TransactionDetail } from "./utils/Interfaces.js";

// Replace with "wss://api.curvemonitor.com" for production
// const url = "http://localhost:443";
const url = "wss://api.curvemonitor.com";

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
export function startPingClient(socket: Socket) {
  // Ping the server every 500ms
  setInterval(() => {
    socket.emit("Ping");
  }, 500);

  socket.on("Pong", () => {
    console.log("Received pong from the server.");
  });

  handleErrors(socket, "/main");
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
  socket.emit("getAbsoluteLabelsRanking");

  socket.on("labelsRanking", (labelsRanking: LabelRankingShort[]) => {
    console.log("Received absolute labels ranking: ", labelsRanking);
    console.log("Number of labels:", labelsRanking.length);
  });

  handleErrors(socket, "/main");
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
  socket.emit("getSandwichLabelOccurrences");

  socket.on("sandwichLabelOccurrences", (labelsOccurrence: LabelRankingExtended[]) => {
    // console.log("Received sandwich label occurrences: ", labelsOccurrence);
    // console.log("Number of labels:", labelsOccurrence.length);

    const bestPerforming = topBestPerformingLabels(labelsOccurrence);
    console.log("Best performing labels: ", bestPerforming);

    const worstPerforming = topWorstPerformingLabels(labelsOccurrence);
    console.log("Worst performing labels: ", worstPerforming);
  });

  handleErrors(socket, "/main");
}
export interface LabelRankingExtended {
  address: string;
  label: string;
  occurrences: number;
  numOfAllTx: number;
}

// Convert user input into pool-suggestions, returns ranked pool suggestions (Pool-Name and Pool-Address)
export function startUserSearchClient(socket: Socket, userInput: string) {
  socket.emit("getUserSearchResult", userInput);

  socket.on("userSearchResult", (userSearchResult: UserSearchResult[]) => {
    console.log("Received user search result: ", userSearchResult);
  });

  handleErrors(socket, "/main");
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
  socket.on("NewSandwich", (sandwichDetails: SandwichDetail) => {
    console.log("Received new sandwich");
    console.dir(sandwichDetails, { depth: null, colors: true });
  });

  socket.emit("connectToGeneralSandwichLivestream");

  handleErrors(socket, "/main");
}

// This function takes care of any connection or generic errors
function handleErrors(socket: Socket, endpoint: string) {
  socket.on("connect_error", (err: Error) => {
    console.log(`Connection Error on ${endpoint}: ${err}`);
  });

  socket.on("error", (err: Error) => {
    console.log(`Error on ${endpoint}: ${err}`);
  });
}

// returns a list/table, of all sandwiches, of all pools, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
export function startFullSandwichTableClient(socket: Socket, timeDuration: string, page: number) {
  socket.emit("getFullSandwichTableContent", timeDuration, page);

  socket.on("fullSandwichTableContent", (fullTableContent: SandwichDetail[]) => {
    console.log("Received full Sandwich-Table Content: ", fullTableContent);
  });

  handleErrors(socket, "/main");
}

// returns a list/table, of sandwiches in a given pool, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
export function startPoolSpecificSandwichTable(socket: Socket, poolAddress: string, timeDuration: string, page: number) {
  socket.emit("getPoolSpecificSandwichTable", poolAddress, timeDuration, page);

  socket.on("SandwichTableContentForPool", (fullTableContent: SandwichDetail[]) => {
    console.log("Received Pool specific Sandwich-Table: ", fullTableContent);
  });

  handleErrors(socket, "/main");
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
  socket.on("NewGeneralTx", (enrichedTransaction: EnrichedTransactionDetail) => {
    console.log("Received new General Tx");
    console.dir(enrichedTransaction, { depth: null, colors: true });
  });

  socket.emit("connectToGeneralTxLivestream");

  handleErrors(socket, "/main");
}

// returns a list/table, of swaps/deposits/withdrawals in a given pool, for a given time period.
// time periods: "1 day", "1 week", "1 month", "full"
// 10 resuts per page
export function startPoolSpecificTransactionTable(socket: Socket, poolAddress: string, timeDuration: string, page: number) {
  socket.emit("getPoolSpecificTransactionTable", poolAddress, timeDuration, page);

  socket.on("TransactionTableContentForPool", (transactionTableContentForPool: EnrichedTransactionDetail[]) => {
    console.log("Received Pool specific Transaction-Table: ", transactionTableContentForPool);
  });

  handleErrors(socket, "/main");
}

export async function startTestClient() {
  const mainSocket = io(`${url}/main`);
  console.log(`connecting to ${url}/main`);

  mainSocket.on("connect", () => {
    console.log("connected");
    // startPingClient(mainSocket);
    // startUserSearchClient(mainSocket, "crvu");
    // startAbsoluteLabelsRankingClient(mainSocket);
    // startSandwichLabelOccurrencesClient(mainSocket);
    // startNewSandwichClient(mainSocket);
    // startFullSandwichTableClient(mainSocket, "1 week", 1);
    // startPoolSpecificSandwichTable(mainSocket, "0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B", "1 week", 1);
    startNewGeneralTxClient(mainSocket);
    // startPoolSpecificTransactionTable(mainSocket, "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46", "1 week", 2);
  });
}
