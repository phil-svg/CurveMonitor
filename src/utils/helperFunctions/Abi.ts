import { updateAbiIWithProxyCheck, updateProxiesFromManualList } from "./ProxyCheck.js";
import { ITransactionTrace } from "../Interfaces.js";
import { getWeb3HttpProvider } from "./Web3.js";
import { ethers } from "ethers";

export async function updateAbisFromTrace(transactionTraces: ITransactionTrace[]): Promise<void> {
  await updateProxiesFromManualList();

  const processedAddresses = new Set<string>();
  let fetchPromises: Promise<any>[] = [];

  const web3HttpProvider = await getWeb3HttpProvider();
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);

  for (const trace of transactionTraces) {
    if (!trace.action.to || processedAddresses.has(trace.action.to)) continue;
    await updateAbiIWithProxyCheck(trace.action.to, JsonRpcProvider, web3HttpProvider);
    processedAddresses.add(trace.action.to);
  }

  if (fetchPromises.length > 0) {
    await Promise.all(fetchPromises);
  }
}
