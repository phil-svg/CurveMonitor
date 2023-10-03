import pkg from "js-sha3";
import { getImplementationAddressFromTable } from "../postgresTables/readFunctions/ProxyCheck.js";
import { updateAbiIWithProxyCheck } from "./ProxyCheck.js";
const { keccak256 } = pkg;

const methodIdCache: { [address: string]: any[] } = {};

export async function getMethodId(contractAddress: string, JsonRpcProvider: any, web3HttpProvider: any): Promise<any[] | null> {
  if (!contractAddress) return null;

  if (!methodIdCache[contractAddress]) {
    // checking if the contract is a proxy
    const implementationAddress = await getImplementationAddressFromTable(contractAddress);
    try {
      const methodIds = await getMethodIdsByContractAddress(implementationAddress || contractAddress, JsonRpcProvider, web3HttpProvider);
      if (methodIds) {
        methodIdCache[contractAddress] = methodIds;
      } else {
        return null;
      }
    } catch (err) {
      console.log(
        err,
        "err getting methodIds for contract",
        implementationAddress || contractAddress,
        "implementationAddress",
        implementationAddress,
        "contractAddress",
        contractAddress
      );
    }
  }
  return methodIdCache[contractAddress];
}

function getMethodIdFromAbi(abiFunctionSignature: string): string {
  const hash = keccak256(abiFunctionSignature);
  return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}

export async function getMethodIdsByContractAddress(
  contractAddress: string,
  JsonRpcProvider: any,
  web3HttpProvider: any
): Promise<Array<{ name: string; signature: string; methodId: string }> | null> {
  // Fetch ABI for given contract address
  const abi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider, web3HttpProvider);

  // If no ABI is found, return null
  if (abi === null) return null;

  let methodIds: Array<{ name: string; signature: string; methodId: string }> = [];

  for (let entry of abi) {
    if (entry.type === "function") {
      const inputTypes = entry.inputs.map((input: any) => input.type).join(",");
      const signature = `${entry.name}(${inputTypes})`;
      const methodId = getMethodIdFromAbi(signature);
      methodIds.push({ name: entry.name, signature: signature, methodId: methodId });
    }
  }

  return methodIds;
}
