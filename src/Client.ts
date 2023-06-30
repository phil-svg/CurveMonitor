import { io, Socket } from "socket.io-client";

// Replace with "wss://api.curvemonitor.com" for production
// const url = "http://localhost:443";
const url = "wss://api.curvemonitor.com";

/**
 * List of Endpoints:
 * wss://api.curvemonitor.com/ping
 * wss://api.curvemonitor.com/allTxDemoRoom // Does emit unformatted tx. For research purposes.
 * wss://api.curvemonitor.com/absoluteLabelsRanking
 * wss://api.curvemonitor.com/sandwichLabelOccurrences
 *
 */

// you say: Ping, I say: Pong. Ping? Pong!
export function startPingClient() {
  const pingSocket = io(`${url}/ping`);

  pingSocket.on("connect", () => {
    console.log("Connected to the ping server.");

    // Ping the server every 500ms
    setInterval(() => {
      pingSocket.emit("Ping");
    }, 500);

    pingSocket.on("Pong", () => {
      console.log("Received pong from the server.");
    });

    handleErrors(pingSocket, "/ping");
  });
}

export function startAllTxDemoRoomClient() {
  const demoRoomSocket = io(`${url}/allTxDemoRoom`);

  demoRoomSocket.on("connect", () => {
    console.log("Connected to the allTxDemoRoom server.");

    demoRoomSocket.on("DemoNewTx", (demoTx) => {
      console.log("Saw new Tx in Demo-Mode: ", demoTx);
    });

    handleErrors(demoRoomSocket, "/allTxDemoRoom");
  });
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
export function startAbsoluteLabelsRankingClient() {
  const labelsRankingSocket = io(`${url}/absoluteLabelsRanking`);

  labelsRankingSocket.on("connect", () => {
    console.log("Connected to the absoluteLabelsRanking server.");

    // request for absolute labels ranking
    labelsRankingSocket.emit("getAbsoluteLabelsRanking");

    labelsRankingSocket.on("absoluteLabelsRanking", (labelsRanking: LabelRankingShort[]) => {
      console.log("Received absolute labels ranking: ", labelsRanking);
      console.log("Number of labels:", labelsRanking.length);
    });

    handleErrors(labelsRankingSocket, "/absoluteLabelsRanking");
  });
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
export function startSandwichLabelOccurrencesClient() {
  const labelsOccurrenceSocket = io(`${url}/sandwichLabelOccurrences`);

  labelsOccurrenceSocket.on("connect", () => {
    console.log("Connected to the sandwichLabelOccurrences server.");

    // request for sandwich label occurrences
    labelsOccurrenceSocket.emit("getSandwichLabelOccurrences");

    labelsOccurrenceSocket.on("sandwichLabelOccurrences", (labelsOccurrence: LabelRankingExtended[]) => {
      console.log("Received sandwich label occurrences: ", labelsOccurrence);
      console.log("Number of labels:", labelsOccurrence.length);
    });

    handleErrors(labelsOccurrenceSocket, "/sandwichLabelOccurrences");
  });
}
export interface LabelRankingExtended {
  address: string;
  label: string;
  occurrences: number;
  numOfAllTx: number;
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

export async function startTestClient() {
  startPingClient();
  startSandwichLabelOccurrencesClient();
}
