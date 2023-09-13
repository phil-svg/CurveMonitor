export async function getImplementationContractAddress(proxyAddress: string, JsonRpcProvider: any): Promise<string> {
  const storagePosition = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implementationContractSlot = await JsonRpcProvider.getStorage(proxyAddress, storagePosition);
  const implementationContractAddress = "0x" + implementationContractSlot.slice(26);

  return implementationContractAddress;
}
