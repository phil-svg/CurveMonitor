import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { getAbiBy } from '../postgresTables/Abi.js';
import { getAddressById, getPoolIdByPoolAddress } from '../postgresTables/readFunctions/Pools.js';
import { Log } from 'web3-core';
import { readAbiFromAbisEthereumTable } from '../postgresTables/readFunctions/Abi.js';
import { WEB3_HTTP_PROVIDER, WEB3_WS_PROVIDER, web3Call } from '../web3Calls/generic.js';
import { ERC20_ABI } from './Erc20Abis.js';
import { ChainName } from '../fiddyResearchTM/DefiMonitooor/DexAggregators/Research/AnyMEV/CleanTransfersWOdb.js';

export function getWeb3WsProvider(): Web3 {
  let web3WsProvider: Web3 | null = null;
  const wsProvider = new Web3.providers.WebsocketProvider(process.env.WEB_WS_MAINNET!);

  // Attach 'end' event listener
  wsProvider.on('end', (err?: Error) => {
    console.log('WS connection ended, reconnecting...', err);
    web3WsProvider = null; // Clear instance so that it can be recreated.
    getWeb3WsProvider(); // Recursive call to recreate the provider.
  });

  wsProvider.on('error', () => {
    console.error('WS encountered an error');
  });

  web3WsProvider = new Web3(wsProvider);

  return web3WsProvider;
}

export async function getWeb3HttpProvider(): Promise<Web3> {
  let web3HttpProvider: Web3 | null = null;

  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 5000; // Delay between retries in milliseconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET!));
      await web3HttpProvider.eth.net.isListening(); // This will throw an error if it can't connect
      return web3HttpProvider;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as any;
        if (err.code === 'ECONNABORTED') {
          console.log(
            `HTTP Provider connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          );
        } else if (err.message && err.message.includes('CONNECTION ERROR')) {
          console.log(
            `HTTP Provider connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          );
        } else {
          // console.log(
          //   `Failed to connect to Ethereum node. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          // );
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  throw new Error(
    'Failed to connect to Ethereum node after several attempts. Please check your connection and the status of the Ethereum node.'
  );
}

export async function getWeb3HttpProviderForChain(chain: ChainName): Promise<Web3> {
  let web3HttpProvider: Web3 | null = null;

  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 5000; // Delay between retries in milliseconds
  let retries = 0;

  let WEB3_HTTP_MAINNET;
  if (chain === 'ethereum') {
    WEB3_HTTP_MAINNET = process.env.WEB3_HTTP_ETHEREUM_DWELLIR;
  } else if (chain === 'base') {
    WEB3_HTTP_MAINNET = process.env.WEB3_HTTP_BASE_DWELLIR;
  }

  while (retries < MAX_RETRIES) {
    try {
      web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET!));
      await web3HttpProvider.eth.net.isListening(); // This will throw an error if it can't connect
      return web3HttpProvider;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as any;
        if (err.code === 'ECONNABORTED') {
          console.log(
            `HTTP Provider connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          );
        } else if (err.message && err.message.includes('CONNECTION ERROR')) {
          console.log(
            `HTTP Provider connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          );
        } else {
          // console.log(
          //   `Failed to connect to Ethereum node. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`
          // );
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  throw new Error(
    'Failed to connect to Ethereum node after several attempts. Please check your connection and the status of the Ethereum node.'
  );
}

export async function getContractByAddress(poolAddress: string): Promise<Contract | void> {
  const POOL_ID = await getPoolIdByPoolAddress(poolAddress);
  if (!POOL_ID) {
    console.log(`Err fetching ABI for pool ${poolAddress} in getContractByAddress`);
    return;
  }

  const CONTRACT = await getContractByPoolID(POOL_ID);
  return CONTRACT;
}

export async function getContractByAddressWithWebsocket(poolAddress: string): Promise<Contract | void> {
  const POOL_ID = await getPoolIdByPoolAddress(poolAddress);
  if (!POOL_ID) {
    console.log(`Err fetching ABI for pool ${poolAddress} in getContractByAddressWithWebsocket`);
    return;
  }

  const CONTRACT = await getContractByPoolIDWithWebsocket(POOL_ID);
  return CONTRACT;
}

export async function getContractByPoolIDWithWebsocket(poolId: number): Promise<Contract | void> {
  try {
    const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
    if (!POOL_ABI) {
      // console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolIDWithWebsocket`);
      return;
    }

    const POOL_ADDRESS = await getAddressById(poolId);
    if (!POOL_ADDRESS) {
      console.log(`Err fetching Address for pool ${poolId}`);
      return;
    }

    const CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
    return CONTRACT;
  } catch (err) {
    console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolIDWithWebsocket2`);
    return;
  }
}

export async function getContractByPoolID(poolId: number): Promise<Contract | void> {
  try {
    const POOL_ADDRESS = await getAddressById(poolId);
    if (!POOL_ADDRESS) {
      console.log(`Err fetching Address for pool ${poolId}`);
      return;
    }

    const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
    if (!POOL_ABI) {
      // console.log(`Err fetching ABI for pool ${poolId} ${POOL_ADDRESS} in getContractByPoolID_1`);
      return;
    }

    const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
    return CONTRACT;
  } catch (err) {
    console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolID_2`);
    return;
  }
}

export async function getContractGlobalByAddress(address: string): Promise<Contract | void> {
  const abi = await readAbiFromAbisEthereumTable(address);
  if (!abi) return;
  return new WEB3_HTTP_PROVIDER.eth.Contract(abi, address);
}

export async function decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS: Log[]): Promise<any[]> {
  const decodedLogs = [];

  for (const log of TOKEN_TRANSFER_EVENTS) {
    if (log.topics.length < 3) continue;

    const fromAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('address', log.topics[1]);
    const toAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('address', log.topics[2]);
    const value = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('uint256', log.data);

    decodedLogs.push({
      tokenAddress: log.address,
      fromAddress,
      toAddress,
      value,
    });
  }

  return decodedLogs;
}

export function toChecksumAddress(address: string): string {
  try {
    return Web3.utils.toChecksumAddress(address);
  } catch (err) {
    // console.log('err in toChecksumAddress', err);
    return address;
  }
}

export async function getTokenDecimalsFromChain(tokenAddress: string): Promise<number | null> {
  const contract = new WEB3_HTTP_PROVIDER.eth.Contract(ERC20_ABI, tokenAddress);
  try {
    const decimals = await web3Call(contract, 'decimals', []);
    return Number(decimals);
  } catch (err) {
    console.log('err in getTokenDecimalsFromChain', err);
    return null;
  }
}

export async function getTokenBalanceForWalletAndTokenAndBlockFromChain(
  tokenAddress: string,
  tokenDecimals: number,
  walletAddress: string,
  blockNumber: number
): Promise<number | null> {
  const contract = new WEB3_HTTP_PROVIDER.eth.Contract(ERC20_ABI, tokenAddress);
  try {
    const balance = await web3Call(contract, 'balanceOf', [walletAddress], blockNumber);
    return Number(balance) / 10 ** tokenDecimals;
  } catch (err) {
    console.log('err in getTokenBalanceForWalletAndTokenAndBlockFromChain', err);
    return null;
  }
}
