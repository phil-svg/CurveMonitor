import { getWeb3HttpProvider, getWeb3WsProvider } from '../../utils/helperFunctions/Web3.js';
import { PEGKEEPER_ABI, POOL_ABI } from './ ABI.js';

export async function getContractPegKeeperWs(address: string) {
  let WEB3_WS_PROVIDER = getWeb3WsProvider();
  const abi: any[] = PEGKEEPER_ABI;
  const contract = new WEB3_WS_PROVIDER.eth.Contract(abi, address);

  return contract;
}

export async function getContractPegKeeperHttp(address: string) {
  let WEB_HTTP_ROVIDER = await getWeb3HttpProvider();
  const abi: any[] = PEGKEEPER_ABI;
  const contract = new WEB_HTTP_ROVIDER.eth.Contract(abi, address);

  return contract;
}

export async function getContractPoolHttp(address: string) {
  let WEB_HTTP_ROVIDER = await getWeb3HttpProvider();
  const abi: any[] = POOL_ABI;
  const contract = new WEB_HTTP_ROVIDER.eth.Contract(abi, address);

  return contract;
}
