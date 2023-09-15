import { Contract } from "web3-eth-contract";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { TransactionReceipt } from "web3-core";
import axios, { AxiosError } from "axios";
import Bottleneck from "bottleneck";
import { BlockNumber, TraceResponse, ITransactionTrace } from "../Interfaces.js";
import { ABI_TRANSFER } from "../helperFunctions/Erc20Abis.js";
import { findCoinAddressById } from "../postgresTables/readFunctions/Coins.js";
import { getTxHashByTxId } from "../postgresTables/readFunctions/Transactions.js";
import axiosRetry from "axios-retry";

const WEB3_HTTP_PROVIDER = await getWeb3HttpProvider();

function isCupsErr(err: Error): boolean {
  return err.message.includes("compute units per second capacity");
}

function isError(err: unknown): err is Error {
  return err instanceof Error;
}

async function delay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 280));
}

async function randomDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
}

export async function getCurrentBlockNumber(): Promise<number | null> {
  let shouldContinue = true;
  let retries = 0;
  const maxRetries = 12;
  let blockNumber: number | null = null;

  while (shouldContinue && retries < maxRetries && !blockNumber) {
    try {
      blockNumber = await WEB3_HTTP_PROVIDER.eth.getBlockNumber();
    } catch (error) {
      if (isError(error) && isCupsErr(error)) {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      } else {
        if (isError(error)) {
          console.log("Error in getCurrentBlockNumber", blockNumber, error.message);
        } else {
          console.log("Error in getCurrentBlockNumber", blockNumber, "Unknown error");
        }
        shouldContinue = false;
      }
    }

    retries++;

    if (!blockNumber && shouldContinue) {
      await delay();
    }
  }

  return blockNumber;
}

export async function getPastEvents(
  CONTRACT: Contract,
  eventName: string,
  fromBlock: number | null,
  toBlock: number | null
): Promise<Array<object> | { start: number; end: number } | null> {
  if (fromBlock === null || toBlock === null) {
    return null;
  }

  let retries = 0;
  const maxRetries = 12;
  let EVENT_ARRAY: Array<object> = [];

  while (retries < maxRetries) {
    try {
      const events = await CONTRACT.getPastEvents(eventName, { fromBlock, toBlock });
      for (const DATA of events) {
        EVENT_ARRAY.push(DATA);
      }
      break;
    } catch (error) {
      if (isError(error) && isCupsErr(error)) {
        await randomDelay();
      } else {
        const errorString = (error as Error).toString();
        if (errorString.includes("Log response size exceeded.")) {
          const matchResult = errorString.match(/\[.*\]/g);
          if (matchResult) {
            const recommendedBlockRange = matchResult[0];
            const [start, end] = recommendedBlockRange
              .slice(1, -1)
              .split(", ")
              .map((x: string) => parseInt(x, 16));
            return { start, end };
          }
        }
        throw error;
      }
    }

    retries++;

    if (EVENT_ARRAY.length === 0) {
      await delay();
    }
  }

  return EVENT_ARRAY;
}

export async function getTokenTransferEvents(coinID: number, blockNumber: number): Promise<Array<object> | { start: number; end: number } | null> {
  const COIN_ADDRESS = await findCoinAddressById(coinID);
  const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_TRANSFER, COIN_ADDRESS!);
  return await getPastEvents(CONTRACT, "Transfer", blockNumber, blockNumber);
}

export async function web3Call(CONTRACT: Contract, method: string, params: any[], blockNumber: BlockNumber | number = { block: "latest" }): Promise<any> {
  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    try {
      return await CONTRACT.methods[method](...params).call(blockNumber);
    } catch (error) {
      if (isError(error) && !isCupsErr(error)) {
        console.log(`${error} | Contract: ${CONTRACT.options.address} | method: ${method} | params: ${params} | blockNumber: ${blockNumber}`);
        shouldContinue = false;
      } else {
        await randomDelay();
      }
    }
    retries++;
    if (shouldContinue) {
      await delay();
    }
  }
}

export async function web3CallLogFree(CONTRACT: Contract, method: string, params: any[], blockNumber: BlockNumber | number = { block: "latest" }): Promise<any> {
  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    try {
      return await CONTRACT.methods[method](...params).call(blockNumber);
    } catch (error) {
      if (isError(error) && !isCupsErr(error)) {
        shouldContinue = false;
      } else {
        await randomDelay();
      }
    }
    retries++;
    if (shouldContinue) {
      await delay();
    }
  }
}

export async function getBlockTimeStamp(blockNumber: number): Promise<number | null> {
  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 600; // Delay between retries in milliseconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
      return Number(BLOCK.timestamp);
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as any;
        if (err.code === "ECONNABORTED") {
          console.log(`getBlockTimeStamp connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        } else if (err.message && err.message.includes("CONNECTION ERROR")) {
          console.log(`getBlockTimeStamp connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        } else {
          console.log(`Failed to get block timestamp. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.log("Failed to get block timestamp after several attempts. Please check your connection and the status of the Ethereum node.");
  return null;
}

export async function getBlockTimeStampsInBatches(blockNumbers: number[]): Promise<{ [blockNumber: number]: number | null }> {
  const blockTimestamps: { [blockNumber: number]: number | null } = {};
  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 5000; // Delay between retries in milliseconds

  for (const blockNumber of blockNumbers) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        console.log(blockNumber, blockNumbers.length);
        const block = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
        blockTimestamps[blockNumber] = Number(block.timestamp);
        break;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const err = error as any;
          if (err.code === "ECONNABORTED") {
            console.log(`getBlockTimeStampsInBatches connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else if (err.message && err.message.includes("CONNECTION ERROR")) {
            console.log(`getBlockTimeStampsInBatches connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else {
            console.log(`Failed to get block timestamp. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }
      if (retries === MAX_RETRIES) {
        console.log(`Failed to get timestamp for block number ${blockNumber} after several attempts. Please check your connection and the status of the Ethereum node.`);
        blockTimestamps[blockNumber] = null;
      }
    }
  }
  return blockTimestamps;
}

export async function getTxReceiptClassic(txHash: string): Promise<TransactionReceipt | null> {
  try {
    const TX_RECEIPT = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
    return TX_RECEIPT;
  } catch (error: any) {
    console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
    return null;
  }
}

export async function getTxReceipt(txHash: string): Promise<any> {
  const limiter = new Bottleneck({
    maxConcurrent: 100,
    minTime: 30,
  });

  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      return retryCount * 2000;
    },
    retryCondition: (error) => {
      return error.code === "ECONNABORTED" || error.code === "ERR_SOCKET_CONNECTION_TIMEOUT";
    },
  });

  return limiter.schedule(async () => {
    try {
      const response = await axios.post(
        `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY!}`,
        {
          id: 1,
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
        },
        {
          timeout: 1000,
        }
      );

      if (response.data && response.data.result) {
        return response.data.result;
      } else {
        return null;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.code !== "ECONNABORTED" && axiosError.code !== "ERR_SOCKET_CONNECTION_TIMEOUT") {
        console.log(axiosError);
      }
      return null;
    }
  });
}

export async function getTxFromTxId(tx_id: number): Promise<any | null> {
  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 5000; // Delay between retries in milliseconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const txHash = await getTxHashByTxId(tx_id);
      const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash!);
      return TX;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as any;
        if (err.code === "ECONNABORTED") {
          console.log(`getTxFromTxId connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        } else if (err.message && err.message.includes("CONNECTION ERROR")) {
          console.log(`getTxFromTxId connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        } else {
          console.log(`Failed to get transaction by ID. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.log(`Failed to get transaction by ID ${tx_id} after several attempts. Please check your connection and the status of the Ethereum node.`);
  return null;
}

export async function getTxWithLimiter(txHash: string): Promise<any | null> {
  const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 300,
  });

  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      return retryCount * 2000;
    },
    retryCondition: (error) => {
      return error.code === "ECONNABORTED" || error.code === "ERR_SOCKET_CONNECTION_TIMEOUT";
    },
  });

  return limiter.schedule(async () => {
    let retries = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 5000;

    while (retries < MAX_RETRIES) {
      try {
        const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
        return TX;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const err = error as any;
          if (err.code === "ECONNABORTED") {
            console.log(`getTxWithLimiter connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else if (err.message && err.message.includes("CONNECTION ERROR")) {
            console.log(`getTxWithLimiter connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else {
            console.log(`Failed to get transaction by hash. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    console.log(`Failed to get transaction by hash ${txHash} after several attempts. Please check your connection and the status of the Ethereum node.`);
    return null;
  });
}

export async function retryGetTransactionTraceViaAlchemy(txHash: string, maxRetries: number = 5): Promise<any[] | null> {
  let delay = 2000; // Starting delay of 2 seconds

  for (let i = 0; i < maxRetries; i++) {
    const transactionTrace = await getTransactionTraceViaAlchemy(txHash);
    if (transactionTrace) {
      return transactionTrace;
    }

    // Wait for delay before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));

    delay *= 2; // Double the delay for the next retry
  }

  // If we've retried the specified number of times and still have no trace, return null.
  return null;
}

export async function getTransactionTraceViaAlchemy(txHash: string, attempt = 0): Promise<ITransactionTrace[] | null> {
  const API_KEY = process.env.ALCHEMY;
  const url = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

  const maxAttempts = 3;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "trace_transaction",
        params: [txHash],
        id: 1,
        jsonrpc: "2.0",
      }),
    });

    if (response.status !== 200) {
      return null; // request failed
    }

    const data = (await response.json()) as TraceResponse;
    return data.result;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ECONNRESET" && attempt < maxAttempts) {
      console.log(`Retry attempt ${attempt + 1} for ${txHash}`);
      // Wait for a second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return getTransactionTraceViaAlchemy(txHash, attempt + 1);
    } else {
      throw error;
    }
  }
}
