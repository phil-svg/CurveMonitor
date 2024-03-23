import { updateAbiIWithProxyCheck } from "./ProxyCheck.js";
import { ITransactionTrace } from "../Interfaces.js";
import { ethers } from "ethers";

export async function updateAbisFromTrace(transactionTraces: ITransactionTrace[]): Promise<void> {
  const processedAddresses = new Set<string>();
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP_MAINNET);

  const uniqueAddresses = new Set(
    transactionTraces
      .filter((trace) => {
        // Check for non-null input, value, or output
        return trace.action.input !== "0x" || trace.action.value !== "0x0" || (trace.result && trace.result.output !== "0x");
      })
      .map((trace) => trace.action.to)
  );

  for (const contractAddress of uniqueAddresses) {
    if (!contractAddress || processedAddresses.has(contractAddress)) continue;
    // console.log("\ncontractAddress", contractAddress);
    await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);
    processedAddresses.add(contractAddress);
  }
}
