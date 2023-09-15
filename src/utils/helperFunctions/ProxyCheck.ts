import { web3Call, web3CallLogFree } from "../web3Calls/generic.js";

export async function getImplementationContractAddressErc1967(proxyAddress: string, JsonRpcProvider: any): Promise<string> {
  const storagePosition = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implementationContractSlot = await JsonRpcProvider.getStorage(proxyAddress, storagePosition);
  const implementationContractAddress = "0x" + implementationContractSlot.slice(26);

  return implementationContractAddress;
}

export async function getImplementationContractAddressErc897(proxyAddress: string, web3: any): Promise<string> {
  const ERCProxyABI = [
    {
      inputs: [],
      name: "implementation",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ];
  const proxyContract = new web3.eth.Contract(ERCProxyABI, proxyAddress);
  // const implementationContractAddress = await web3Call(proxyContract, "implementation", []);
  const implementationContractAddress = await web3CallLogFree(proxyContract, "implementation", []);

  return implementationContractAddress;
}
