import {
  ITransactionTrace,
  ParsedEvent,
  ReadableTokenTransfer,
  TokenTransfer,
  TraceResponse,
} from '../../../../../Interfaces.js';
import Web3 from 'web3';
import { NULL_ADDRESS } from '../../../../../helperFunctions/Constants.js';
import axios, { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { CoinDetails } from '../../../../../postgresTables/readFunctions/Coins.js';
import {
  addPositionField,
  filterNullSymbols,
  findTokenDetails,
  removeDuplicatesAndUpdatePositions,
  updateTransferList,
} from '../../../../../txMap/TransferOverview.js';
import {
  ABI_DECIMALS,
  ABI_SYMBOL,
  ADDRESS_ETH,
  ADDRESS_MKR,
  ADDRESS_REUSD,
} from '../../../../../postgresTables/Coins.js';
import { filterForCorrectTransfers } from '../../../../../postgresTables/mevDetection/atomic/atomicArb.js';

export async function getTransactionTraceViaWeb3ProviderForChain(
  txHash: string,
  chain: ChainName,
  attempt = 0
): Promise<ITransactionTrace[] | null> {
  let url;
  if (chain === 'ethereum') {
    url = `${process.env.WEB3_HTTP_MAINNET_PROVIDER_URL_ERIGON}`;
  } else if (chain === 'base') {
    url = `${process.env.WEB3_HTTP_BASE_DWELLIR}`;
  } else {
    return null;
  }

  const maxAttempts = 3;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'trace_transaction',
        params: [txHash],
        id: 1,
        jsonrpc: '2.0',
      }),
    });

    if (response.status !== 200) {
      return null; // request failed
    }

    const data = (await response.json()) as TraceResponse;
    return data.result;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ECONNRESET' && attempt < maxAttempts) {
      console.log(`Retry attempt ${attempt + 1} for ${txHash}`);
      // Wait for a second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return getTransactionTraceViaWeb3ProviderForChain(txHash, chain, attempt + 1);
    } else {
      throw error;
    }
  }
}

export type ChainName = 'ethereum' | 'base';

export async function getTxReceiptFromProviderForChain(txHash: string, chain: ChainName): Promise<any | null> {
  try {
    let providerUrl;
    if (chain === 'ethereum') {
      providerUrl = `${process.env.WEB3_HTTP_ETHEREUM_DWELLIR}`;
    } else if (chain === 'base') {
      providerUrl = `${process.env.WEB3_HTTP_BASE_DWELLIR}`;
    } else {
      return null;
    }
    const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(providerUrl));

    let txReceipt = await web3HttpProvider.eth.getTransactionReceipt(txHash);
    return txReceipt;
  } catch (error: any) {
    console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
    return null;
  }
}

export async function fetchAbiFromEtherscanForChain(address: string, chain: ChainName): Promise<any[] | null> {
  if (address === NULL_ADDRESS) return null;

  let chainHolder;
  let apiKey;
  if (chain === 'ethereum') {
    chainHolder = 'etherscan.io';
    apiKey = process.env.ETHERSCAN_KEY;
  } else if (chain === 'base') {
    chainHolder = 'basescan.org';
    apiKey = process.env.BASESCAN_KEY;
  }

  const URL = `https://api.${chainHolder}/api?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;

  const fetchAbi = async (retryCount = 0, maxRetries = 10): Promise<string> => {
    try {
      const response = await axios.get<{ result: string }>(URL, { timeout: 30000 });
      return response.data.result;
    } catch (error) {
      if (
        error instanceof AxiosError &&
        (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ECONNRESET' ||
          error.response?.status === 503 || // Service Unavailable
          error.response?.status === 502 || // Bad Gateway
          error.response?.status === 429) && // Too Many Requests (Rate Limiting)
        retryCount < maxRetries
      ) {
        const delayTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delayTime));
        return fetchAbi(retryCount + 1, maxRetries);
      } else {
        throw error;
      }
    }
  };

  const etherscanLimiter = new Bottleneck({
    maxConcurrent: 1, // Max number of concurrent requests
    minTime: 200, // Minimum time between requests
  });

  const ABIString = await etherscanLimiter.schedule(() => fetchAbi());
  if (ABIString === 'Contract source code not verified') return null;
  try {
    return JSON.parse(ABIString);
  } catch (err) {
    return null;
  }
}

export async function parseEventsFromReceiptForEntireTxWOdb(
  txHash: string,
  chain: ChainName,
  web3HttpProvider: any
): Promise<(ParsedEvent | null | undefined)[] | null> {
  const receipt = await getTxReceiptFromProviderForChain(txHash, chain);

  if (!receipt) {
    // console.log(`No receipt for ${txHash} in function parseEventsFromReceiptForEntireTx`);
    return null;
  }

  // This set will store topics we've already processed
  const processedTopics = new Set<string>();

  const parsedEventsPromises = receipt!.logs.map(async (log: any) => {
    let contractAddress = log.address;

    // Add the topic to the set of processed topics
    processedTopics.add(log.topics[0]);

    // let contractAbi = await fetchAbiFromEtherscanForChain(contractAddress, chain);

    const hardcodedTransferEvent = {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'src', type: 'address' },
        { indexed: true, internalType: 'address', name: 'dst', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'wad', type: 'uint256' },
      ],
      name: 'Transfer',
      type: 'event',
    };

    // if (!contractAbi) {
    //   contractAbi = [hardcodedTransferEvent];
    // }

    let contractAbi = [hardcodedTransferEvent];

    // Check if the 'Transfer' event is already part of the ABI
    const hasTransferEvent = contractAbi.some((item) => item.type === 'event' && item.name === 'Transfer');

    // If the 'Transfer' event is not found, add the hardcoded event
    if (!hasTransferEvent) {
      contractAbi.push(hardcodedTransferEvent);
    }

    try {
      const eventAbi = contractAbi.find(
        (abiItem: any) =>
          abiItem.type === 'event' && log.topics[0] === web3HttpProvider.eth.abi.encodeEventSignature(abiItem)
      );

      if (!eventAbi) return null;

      const decodedLog = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));

      for (const key in decodedLog) {
        if (!isNaN(Number(key)) || key === '__length__') {
          delete decodedLog[key];
        }
      }

      const parsedEvent: ParsedEvent = {
        ...decodedLog,
        contractAddress: log.address,
        eventName: eventAbi.name,
      };

      return parsedEvent;
    } catch (err) {
      // console.error(`Error in parseEventsForEntireTx ${err}`);
      // console.log("Failed log data:", log);
      return null;
    }
  });

  let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
  resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== 'string');

  return resolvedParsedEvents;
}

/**
 * Merges token transfers from transaction traces with parsed events from a receipt,
 * placing new entries in the first array based on their position in the second array.
 *
 * @param parsedEventsFromReceipt - Array of parsed events (possibly including null or undefined elements).
 * @returns Array of TokenTransfer objects after merging and filtering.
 */
export function filterTransfers(parsedEventsFromReceipt: (ParsedEvent | null | undefined)[]): TokenTransfer[] {
  let tokenTransfers: TokenTransfer[] = [];
  // Filter out only transfer events from the parsed events
  const transferEventsFromReceipt = parsedEventsFromReceipt.filter((event) => event?.eventName === 'Transfer');

  // Iterate over each transfer event from the receipt
  transferEventsFromReceipt.forEach((event, index) => {
    if (event) {
      // Extract keys from the event object
      const keys = Object.keys(event);

      const newTransfer = {
        from: event[keys[0]],
        to: event[keys[1]],
        token: event[keys[3]],
        value: event[keys[2]],
      };

      // Insert at the same index as in parsedEventsFromReceipt, or push at the end if index is out of bounds
      if (index < tokenTransfers.length) {
        tokenTransfers.splice(index, 0, newTransfer);
      } else {
        tokenTransfers.push(newTransfer);
      }
    }
  });

  // Return the merged and reordered array of transfers
  return tokenTransfers;
}

export async function getTokenSymbolWOdbForChain(coinAddress: string, web3HttpProvider: any): Promise<string> {
  if (coinAddress === ADDRESS_ETH) return 'ETH';
  if (coinAddress === ADDRESS_MKR) return 'MKR';
  if (coinAddress === ADDRESS_REUSD) return 'REUSD';
  const CONTRACT = new web3HttpProvider.eth.Contract(ABI_SYMBOL, coinAddress);
  return CONTRACT.methods.symbol().call();
}

export async function getTokenDecimalWOdbForChain(coinAddress: string, web3HttpProvider: any): Promise<number> {
  if (coinAddress === ADDRESS_ETH) return 18;
  const CONTRACT = new web3HttpProvider.eth.Contract(ABI_DECIMALS, coinAddress);
  return CONTRACT.methods.decimals().call();
}

export async function getTokenDetailsForTokenArrayWOdb(
  uniqueTokenArray: string[],
  web3HttpProvider: any,
  getAllToken: boolean
): Promise<CoinDetails[]> {
  const hardcodedTokens: { [address: string]: { symbol: string; decimals: number } } = {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
  };

  const tokenDetailsArray: CoinDetails[] = [];

  for (const coinAddress of uniqueTokenArray) {
    try {
      const normalizedAddress = coinAddress.toLowerCase(); // Normalize the address for case-insensitive comparison

      let symbol: string, decimals: number;

      // Check if the address has hardcoded values, use them if available
      if (hardcodedTokens[normalizedAddress]) {
        symbol = hardcodedTokens[normalizedAddress].symbol;
        decimals = hardcodedTokens[normalizedAddress].decimals;
      } else {
        if (getAllToken) {
          // Otherwise, fetch dynamically
          const symbolPromise = getTokenSymbolWOdbForChain(coinAddress, web3HttpProvider);
          const decimalsPromise = getTokenDecimalWOdbForChain(coinAddress, web3HttpProvider);

          [symbol, decimals] = await Promise.all([symbolPromise, decimalsPromise]);
        } else {
          continue;
        }
      }

      // Push the token details to the array
      tokenDetailsArray.push({
        address: coinAddress,
        symbol: symbol,
        decimals: decimals,
      });
    } catch (error) {
      // console.error(`Failed to fetch details for token address ${coinAddress}:`, error);
      tokenDetailsArray.push({
        address: coinAddress,
        symbol: null,
        decimals: null,
      });
    }
  }

  return tokenDetailsArray;
}

export async function makeTransfersReadableWOdb(
  tokenTransfers: TokenTransfer[],
  web3HttpProvider: any,
  getAllToken: boolean
): Promise<ReadableTokenTransfer[]> {
  let readableTransfers: ReadableTokenTransfer[] = [];

  const uniqueTokens = new Set(tokenTransfers.map((transfer) => transfer.token));
  const uniqueTokenArray = Array.from(uniqueTokens);
  const tokenDetailsArray = await getTokenDetailsForTokenArrayWOdb(uniqueTokenArray, web3HttpProvider, getAllToken);

  for (let transfer of tokenTransfers) {
    const details = findTokenDetails(transfer.token, tokenDetailsArray);
    const tokenSymbol = details?.symbol;
    const tokenDecimals = details?.decimals;

    if (!tokenDecimals || tokenDecimals === 0 || tokenDecimals === 420) continue;
    if (!tokenSymbol) continue;

    let parsedAmount = 0;

    if (tokenDecimals !== null) {
      const rawAmountBigInt = BigInt(transfer.value);
      const coinAmount = Number(rawAmountBigInt) / Math.pow(10, tokenDecimals);
      parsedAmount = Number(coinAmount.toFixed(15));
    }

    readableTransfers.push({
      from: transfer.from,
      to: transfer.to,
      tokenAddress: transfer.token,
      tokenSymbol,
      parsedAmount,
    });
  }

  readableTransfers = filterNullSymbols(readableTransfers);
  const res = addPositionField(readableTransfers);
  return res;
}

export async function getCleanedTransfersWOdbWOtraceForChain(
  txHash: string,
  chain: ChainName,
  web3HttpProvider: any,
  to: string,
  getAllToken: boolean
): Promise<ReadableTokenTransfer[] | null> {
  const parsedEventsFromReceipt = await parseEventsFromReceiptForEntireTxWOdb(txHash, chain, web3HttpProvider);
  if (!parsedEventsFromReceipt) {
    console.log('Failed to get Receipt');
    return null;
  }
  // console.log('parsedEventsFromReceipt', parsedEventsFromReceipt);

  const transfers = filterTransfers(parsedEventsFromReceipt);
  const readableTransfers = await makeTransfersReadableWOdb(transfers, web3HttpProvider, getAllToken);

  let updatedReadableTransfers: ReadableTokenTransfer[] = [];
  updatedReadableTransfers = updateTransferList(readableTransfers, to);

  const correctTrasfers = filterForCorrectTransfers(updatedReadableTransfers);
  const cleanedTransfers = removeDuplicatesAndUpdatePositions(correctTrasfers);

  return cleanedTransfers;
}
