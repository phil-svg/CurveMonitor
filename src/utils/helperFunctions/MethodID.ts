import pkg from "js-sha3";
import { getImplementationAddressFromTable } from "../postgresTables/readFunctions/ProxyCheck.js";
import { updateAbiIWithProxyCheck } from "./ProxyCheck.js";
import { getAbiByForPools } from "../postgresTables/Abi.js";
import { getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
const { keccak256 } = pkg;

export async function getMethodId(contractAddress: string, JsonRpcProvider: any): Promise<any[] | null> {
  if (!contractAddress) return null;

  // Always fetch method IDs without checking the cache
  try {
    const implementationAddress = await getImplementationAddressFromTable(contractAddress);
    const methodIds = await getMethodIdsByContractAddress(implementationAddress || contractAddress, JsonRpcProvider);
    return methodIds || [];
  } catch (err) {
    console.log(err);
    return null;
  }
}

function getMethodIdFromAbi(abiFunctionSignature: string): string {
  const hash = keccak256(abiFunctionSignature);
  return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}

export const abiCache: { [contractAddress: string]: any[] } = {};

export async function getMethodIdsByContractAddress(contractAddress: string, JsonRpcProvider: any): Promise<Array<{ name: string; signature: string; methodId: string }> | null> {
  // Fetch ABI for given contract address
  let abi = abiCache[contractAddress];
  if (!abi) {
    abi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);
    if (abi !== null && Array.isArray(abi)) {
      abiCache[contractAddress] = abi;
    } else {
      return null;
    }
  }

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

export async function getMethodIdsForPoolAddressLight(poolAddress: string): Promise<Array<{ name: string; signature: string; methodId: string }> | null> {
  // Fetch ABI for given contract address
  const poolId = await getIdByAddress(poolAddress);
  if (!poolId) {
    console.log("Could not find poolId for", poolAddress, "in getMethodIdsByContractAddressLight");
    return null;
  }
  let abi = await getAbiByForPools({ id: poolId });
  if (!abi) {
    console.log("Could not find abi for", poolAddress, "in getMethodIdsByContractAddressLight");
    return null;
  }

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
