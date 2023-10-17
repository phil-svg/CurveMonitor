import { updateAbiIWithProxyCheck, updateProxiesFromManualList } from "./ProxyCheck.js";
import { getWeb3HttpProvider } from "./Web3.js";
import { ethers } from "ethers";
export async function updateAbisFromTrace(transactionTraces) {
    await updateProxiesFromManualList();
    const processedAddresses = new Set();
    const web3HttpProvider = await getWeb3HttpProvider();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);
    const uniqueAddresses = new Set(transactionTraces.map((trace) => trace.action.to));
    for (const contractAddress of uniqueAddresses) {
        if (!contractAddress || processedAddresses.has(contractAddress))
            continue;
        await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider, web3HttpProvider);
        processedAddresses.add(contractAddress);
    }
}
//# sourceMappingURL=Abi.js.map