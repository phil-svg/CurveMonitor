import Web3 from "web3";
import { Contract } from 'web3-eth-contract';
import { getAbiBy } from '../postgresTables/Abi.js';
import { getAddressById, getIdByAddress } from '../postgresTables/readFunctions/Pools.js';

let web3WsProvider: Web3 | null = null;

export function getWeb3WsProvider(): Web3 {
  if (!web3WsProvider) {
    web3WsProvider = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS!));
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

const WEB3_WS_PROVIDER = getWeb3WsProvider();
const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

export async function getContractByAddress(poolAddress:string): Promise<Contract | void> {

  const POOL_ID = await getIdByAddress(poolAddress)
  if(!POOL_ID){
    console.log(`Err fetching ABI for pool ${poolAddress}`)
    return
  }

  const CONTRACT = await getContractByPoolID(POOL_ID);
  return CONTRACT
}

export async function getContractByPoolID(poolId:number): Promise<Contract | void> {

  const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
  if(!POOL_ABI){
    console.log(`Err fetching ABI for pool ${poolId}`)
    return
  }

  const POOL_ADDRESS = await getAddressById(poolId)
  if(!POOL_ADDRESS){
    console.log(`Err fetching Address for pool ${poolId}`)
    return
  }

  const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
  return CONTRACT
}