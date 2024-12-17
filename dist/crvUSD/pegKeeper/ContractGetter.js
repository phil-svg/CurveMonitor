import { getWeb3HttpProvider, getWeb3WsProvider } from '../../utils/helperFunctions/Web3.js';
import { PEGKEEPER_ABI, POOL_ABI } from './ ABI.js';
export async function getContractPegKeeperWs(address) {
    let WEB3_WS_PROVIDER = getWeb3WsProvider();
    const abi = PEGKEEPER_ABI;
    const contract = new WEB3_WS_PROVIDER.eth.Contract(abi, address);
    return contract;
}
export async function getContractPegKeeperHttp(address) {
    let WEB_HTTP_ROVIDER = await getWeb3HttpProvider();
    const abi = PEGKEEPER_ABI;
    const contract = new WEB_HTTP_ROVIDER.eth.Contract(abi, address);
    return contract;
}
export async function getContractPoolHttp(address) {
    let WEB_HTTP_ROVIDER = await getWeb3HttpProvider();
    const abi = POOL_ABI;
    const contract = new WEB_HTTP_ROVIDER.eth.Contract(abi, address);
    return contract;
}
//# sourceMappingURL=ContractGetter.js.map