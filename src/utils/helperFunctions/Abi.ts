import { updateAbiIWithProxyCheck, updateProxiesFromManualList } from "./ProxyCheck.js";
import { ITransactionTrace } from "../Interfaces.js";
import { getWeb3HttpProvider } from "./Web3.js";
import { ethers } from "ethers";

export async function updateAbisFromTrace(transactionTraces: ITransactionTrace[]): Promise<void> {
  await updateProxiesFromManualList();

  const processedAddresses = new Set<string>();

  const web3HttpProvider = await getWeb3HttpProvider();
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);

  const uniqueAddresses = new Set(transactionTraces.map((trace) => trace.action.to));

  for (const contractAddress of uniqueAddresses) {
    if (!contractAddress || processedAddresses.has(contractAddress)) continue;
    await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider, web3HttpProvider);
    processedAddresses.add(contractAddress);
  }
}
