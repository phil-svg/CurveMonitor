import pkg from "js-sha3";
import { readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";
import { ITransactionTrace } from "../Interfaces.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { AbisEthereum } from "../../models/Abi.js";
const { keccak256 } = pkg;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function updateAbisFromTrace(transactionTraces: ITransactionTrace[]): Promise<void> {
  for (const trace of transactionTraces) {
    const contractAddress = trace.action.to;
    const existingAbi = await readAbiFromAbisEthereumTable(contractAddress);

    if (!existingAbi) {
      const fetchedAbi = await fetchAbiFromEtherscan(contractAddress);
      if (fetchedAbi && fetchedAbi.length) {
        try {
          await AbisEthereum.create({
            contract_address: contractAddress,
            abi: fetchedAbi,
          });
        } catch (err) {
          console.log(`Error storing Abi in AbisEthereum ${err}`);
        }

        // capping to 5 calles per sec
        await delay(200);
      }
    }
  }
}

const methodIdCache: { [address: string]: any[] } = {};

export async function getMethodId(contractAddress: string): Promise<any[] | null> {
  if (!methodIdCache[contractAddress]) {
    const methodIds = await getMethodIdsByContractAddress(contractAddress);
    if (methodIds) {
      methodIdCache[contractAddress] = methodIds;
    } else {
      return null;
    }
  }
  return methodIdCache[contractAddress];
}

function getMethodIdFromAbi(abiFunctionSignature: string): string {
  const hash = keccak256(abiFunctionSignature);
  return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}

export async function getMethodIdsByContractAddress(contractAddress: string): Promise<Array<{ name: string; signature: string; methodId: string }> | null> {
  // Fetch ABI for given contract address
  const abi = await readAbiFromAbisEthereumTable(contractAddress);

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
