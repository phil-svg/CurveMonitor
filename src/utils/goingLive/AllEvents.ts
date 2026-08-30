import { getWeb3HttpProvider } from '../helperFunctions/Web3.js';

export interface EvmLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

const handlers: ((logs: EvmLogEntry[]) => void)[] = [];

export function registerHandler(handler: (logs: EvmLogEntry[]) => void) {
  handlers.push(handler);
}

// One shared Web3 instance for log-decoding (building one per call is expensive; the abi coder is stateless).
let decodingWeb3: Awaited<ReturnType<typeof getWeb3HttpProvider>> | null = null;
async function getDecodingWeb3() {
  if (!decodingWeb3) decodingWeb3 = await getWeb3HttpProvider();
  return decodingWeb3;
}

// topic0 -> event abi item, computed once per unique (interned) ABI array.
const topicMapCache = new WeakMap<any[], Map<string, any>>();

async function getTopicMap(abi: any[]): Promise<Map<string, any>> {
  let topicMap = topicMapCache.get(abi);
  if (topicMap) return topicMap;
  const web3 = await getDecodingWeb3();
  topicMap = new Map();
  for (const item of abi) {
    if (item.type === 'event') {
      topicMap.set(web3.eth.abi.encodeEventSignature(item), item);
    }
  }
  topicMapCache.set(abi, topicMap);
  return topicMap;
}

/**
 * Decodes a single raw log against the given ABI. Returns the same formatted-event shape
 * as fetchEventsRealTime, or null if the log's topic0 matches no event in the ABI.
 */
export async function decodeLogWithAbi(log: EvmLogEntry, abi: any[]): Promise<any | null> {
  const topicMap = await getTopicMap(abi);
  const eventAbi = topicMap.get(log.topics[0]);
  if (!eventAbi) return null;

  const web3 = await getDecodingWeb3();
  const decoded = web3.eth.abi.decodeLog(eventAbi.inputs!, log.data, log.topics.slice(1));

  const returnValues = Object.entries(decoded)
    .filter(([key]) => isNaN(Number(key)) && key !== '__length__')
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

  return {
    address: log.address,
    event: eventAbi.name,
    returnValues,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    blockHash: log.blockHash,
    logIndex: log.logIndex,
    removed: log.removed,
  };
}

export async function startListeningToAllEvents() {
  let web3HttpProvider = await getWeb3HttpProvider();
  let lastBlockNumber = await web3HttpProvider.eth.getBlockNumber();
  await getLogsForBlock(lastBlockNumber);

  // Periodic check every 10 minutes to update and log the current block
  setInterval(
    async () => {
      try {
        lastBlockNumber = (await web3HttpProvider.eth.getBlockNumber()) - 1;
      } catch (err) {
        console.error('Error during periodic block check:', err);
      }
    },
    10 * 60 * 1000
  ); // 10 minutes in milliseconds

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 12 * 1000));
    try {
      const nextBlock = lastBlockNumber + 1;
      await getLogsForBlock(nextBlock);
      lastBlockNumber = nextBlock; // Only increment if successful
    } catch (err) {
      console.error(`Failed to process block ${lastBlockNumber + 1}:`, err);
    }
  }
}

async function getLogsForBlock(blockNumber: number) {
  let web3HttpProvider = await getWeb3HttpProvider();
  const params = {
    fromBlock: blockNumber,
    toBlock: blockNumber,
  };
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const logs: EvmLogEntry[] = await web3HttpProvider.eth.getPastLogs(params);
      // console.log(`Number of logs for block ${blockNumber}: ${logs.length}`);
      handlers.forEach((handler) => handler(logs));
      return; // Success, exit the retry loop
    } catch (err) {
      retries++;
      if (retries >= maxRetries) {
        throw new Error(`Failed to get logs for block ${blockNumber} after ${maxRetries} retries`);
      }
      console.log(`Retrying block ${blockNumber}, attempt ${retries} of ${maxRetries}`);
      // Exponential backoff: wait longer with each retry (1s, 2s, 3s, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
    }
  }
}

export async function fetchEventsRealTime(
  evmEventLogs: EvmLogEntry[],
  contractAddress: string,
  abi: any[],
  eventName: string
) {
  let eventAbis: any[];
  let web3HttpProvider = await getWeb3HttpProvider();

  if (eventName === 'AllEvents') {
    eventAbis = abi.filter((item) => item.type === 'event');
  } else {
    const eventAbi = abi.find((item) => item.type === 'event' && item.name === eventName);
    if (!eventAbi) {
      throw new Error(`Event ${eventName} not found in ABI`);
    }
    eventAbis = [eventAbi];
  }

  let allFormattedEvents: any[] = [];

  for (const eventAbi of eventAbis) {
    const eventSignature = web3HttpProvider.eth.abi.encodeEventSignature(eventAbi);

    const filteredLogs = evmEventLogs.filter(
      (log) => log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics[0] === eventSignature
    );

    const formattedEvents = filteredLogs.map((log) => {
      const decoded = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs!, log.data, log.topics.slice(1));

      const returnValues = Object.entries(decoded)
        .filter(([key]) => isNaN(Number(key)) && key !== '__length__')
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      return {
        address: log.address,
        event: eventAbi.name,
        returnValues,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        logIndex: log.logIndex,
        removed: log.removed,
      };
    });

    allFormattedEvents = allFormattedEvents.concat(formattedEvents);
  }

  return allFormattedEvents;
}
