import { updateAbiIWithProxyCheck } from './ProxyCheck.js';
import { ethers } from 'ethers';
/*
const processedAddresses = new Set<string>();

export async function updateAbisFromTraceFast(transactionTraces: ITransactionTrace[]): Promise<void> {
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP_MAINNET);

  const uniqueAddresses = new Set(
    transactionTraces
      .filter((trace) => {
        // Check for non-null input, value, or output
        return (
          trace.action.input !== '0x' || trace.action.value !== '0x0' || (trace.result && trace.result.output !== '0x')
        );
      })
      .map((trace) => trace.action.to)
  );

  for (const contractAddress of uniqueAddresses) {
    if (!contractAddress) continue;
    const lowercaseAddress = contractAddress.toLowerCase();
    if (!processedAddresses.has(lowercaseAddress)) {
      await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);
      processedAddresses.add(lowercaseAddress);
    }
  }
}
*/
export async function updateAbisFromTrace(transactionTraces) {
    const processedAddresses = new Set();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP_MAINNET);
    const uniqueAddresses = new Set(transactionTraces
        .filter((trace) => {
        // Check for non-null input, value, or output
        return (trace.action.input !== '0x' || trace.action.value !== '0x0' || (trace.result && trace.result.output !== '0x'));
    })
        .map((trace) => trace.action.to));
    for (const contractAddress of uniqueAddresses) {
        if (!contractAddress || processedAddresses.has(contractAddress))
            continue;
        await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);
        processedAddresses.add(contractAddress);
    }
}
//# sourceMappingURL=Abi.js.map