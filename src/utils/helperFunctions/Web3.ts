import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { getAbiBy } from "../postgresTables/Abi.js";
import { getAddressById, getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { Log } from "web3-core";

let web3WsProvider: Web3 | null = null;

export function getWeb3WsProvider(): Web3 {
  if (!web3WsProvider) {
    const wsProvider = new Web3.providers.WebsocketProvider(process.env.WEB3_WSS!);

    // Attach 'end' event listener
    wsProvider.on("end", (err?: Error) => {
      console.log("WS connection ended, reconnecting...", err);
      web3WsProvider = null; // Clear instance so that it can be recreated.
      getWeb3WsProvider(); // Recursive call to recreate the provider.
    });

    // Attach 'error' event listener
    wsProvider.on("error", () => {
      console.error("WS encountered an error");
    });

    web3WsProvider = new Web3(wsProvider);
  }

  return web3WsProvider;
}

let web3HttpProvider: Web3 | null = null;

export function getWeb3HttpProvider(): Web3 {
  if (!web3HttpProvider) {
    web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP!));
  }
  return web3HttpProvider;
}

export async function getContractByAddress(poolAddress: string): Promise<Contract | void> {
  const POOL_ID = await getIdByAddress(poolAddress);
  if (!POOL_ID) {
    console.log(`Err fetching ABI for pool ${poolAddress}`);
    return;
  }

  const CONTRACT = await getContractByPoolID(POOL_ID);
  return CONTRACT;
}

export async function getContractByAddressWithWebsocket(poolAddress: string): Promise<Contract | void> {
  const POOL_ID = await getIdByAddress(poolAddress);
  if (!POOL_ID) {
    console.log(`Err fetching ABI for pool ${poolAddress}`);
    return;
  }

  const CONTRACT = await getContractByPoolIDWithWebsocket(POOL_ID);
  return CONTRACT;
}

export async function getContractByPoolIDWithWebsocket(poolId: number): Promise<Contract | void> {
  try {
    const POOL_ABI = await getAbiBy("AbisPools", { id: poolId });
    if (!POOL_ABI) {
      console.log(`Err fetching ABI for pool ${poolId}`);
      return;
    }

    const POOL_ADDRESS = await getAddressById(poolId);
    if (!POOL_ADDRESS) {
      console.log(`Err fetching Address for pool ${poolId}`);
      return;
    }

    const web3 = getWeb3WsProvider();
    const CONTRACT = new web3.eth.Contract(POOL_ABI, POOL_ADDRESS);
    return CONTRACT;
  } catch (err) {
    console.log(`Err fetching ABI for pool ${poolId}`);
    return;
  }
}

export async function getContractByPoolID(poolId: number): Promise<Contract | void> {
  try {
    const POOL_ABI = await getAbiBy("AbisPools", { id: poolId });
    if (!POOL_ABI) {
      console.log(`Err fetching ABI for pool ${poolId}`);
      return;
    }

    const POOL_ADDRESS = await getAddressById(poolId);
    if (!POOL_ADDRESS) {
      console.log(`Err fetching Address for pool ${poolId}`);
      return;
    }

    const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
    const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
    return CONTRACT;
  } catch (err) {
    console.log(`Err fetching ABI for pool ${poolId}`);
    return;
  }
}

export function decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS: Log[]): any[] {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
  const decodedLogs = [];

  for (const log of TOKEN_TRANSFER_EVENTS) {
    if (log.topics.length < 3) continue;

    const fromAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter("address", log.topics[1]);
    const toAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter("address", log.topics[2]);
    const value = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter("uint256", log.data);

    decodedLogs.push({
      tokenAddress: log.address,
      fromAddress,
      toAddress,
      value,
    });
  }

  return decodedLogs;
}
