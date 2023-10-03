import { updateAbiIWithProxyCheck, updateProxiesFromManualList } from "./ProxyCheck.js";
import { getWeb3HttpProvider } from "./Web3.js";
import { ethers } from "ethers";
export async function updateAbisFromTrace(transactionTraces) {
    await updateProxiesFromManualList();
    const processedAddresses = new Set();
    const web3HttpProvider = await getWeb3HttpProvider();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);
    for (const trace of transactionTraces) {
        if (!trace.action.to || processedAddresses.has(trace.action.to))
            continue;
        await updateAbiIWithProxyCheck(trace.action.to, JsonRpcProvider, web3HttpProvider);
        processedAddresses.add(trace.action.to);
    }
}
//# sourceMappingURL=Abi.js.map