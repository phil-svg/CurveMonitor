import pkg from "js-sha3";
import { readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { AbisEthereum } from "../../models/Abi.js";
const { keccak256 } = pkg;
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function updateAbisFromTrace(transactionTraces) {
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
                }
                catch (err) {
                    console.log(`Error storing Abi in AbisEthereum ${err}`);
                }
                // capping to 5 calles per sec
                await delay(200);
            }
        }
    }
}
const methodIdCache = {};
export async function getMethodId(contractAddress) {
    if (!methodIdCache[contractAddress]) {
        const methodIds = await getMethodIdsByContractAddress(contractAddress);
        if (methodIds) {
            methodIdCache[contractAddress] = methodIds;
        }
        else {
            return null;
        }
    }
    return methodIdCache[contractAddress];
}
function getMethodIdFromAbi(abiFunctionSignature) {
    const hash = keccak256(abiFunctionSignature);
    return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}
export async function getMethodIdsByContractAddress(contractAddress) {
    // Fetch ABI for given contract address
    const abi = await readAbiFromAbisEthereumTable(contractAddress);
    // If no ABI is found, return null
    if (abi === null)
        return null;
    let methodIds = [];
    for (let entry of abi) {
        if (entry.type === "function") {
            const inputTypes = entry.inputs.map((input) => input.type).join(",");
            const signature = `${entry.name}(${inputTypes})`;
            const methodId = getMethodIdFromAbi(signature);
            methodIds.push({ name: entry.name, signature: signature, methodId: methodId });
        }
    }
    return methodIds;
}
//# sourceMappingURL=MethodID.js.map