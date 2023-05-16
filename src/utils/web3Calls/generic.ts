import { Contract } from "web3-eth-contract";
import { getWeb3WsProvider, getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { TransactionReceipt } from "web3-core";

const WEB3_WS_PROVIDER = getWeb3WsProvider();
const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

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

interface BlockNumber {
  block: string | number;
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

export async function getBlockTimeStamp(blockNumber: number): Promise<number> {
  const BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
  return Number(BLOCK.timestamp);
}

export async function getTxReceipt(txHash: string): Promise<TransactionReceipt | null> {
  try {
    const TX_RECEIPT = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
    return TX_RECEIPT;
  } catch (error: any) {
    console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
    return null;
  }
}
