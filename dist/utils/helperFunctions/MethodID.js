import pkg from "js-sha3";
import { getImplementationAddressFromTable } from "../postgresTables/readFunctions/ProxyCheck.js";
import { updateAbiIWithProxyCheck } from "./ProxyCheck.js";
const { keccak256 } = pkg;
export const methodIdCache = {};
export async function getMethodId(contractAddress, JsonRpcProvider, web3HttpProvider) {
    if (!contractAddress)
        return null;
    if (!methodIdCache[contractAddress]) {
        // checking if the contract is a proxy
        const implementationAddress = await getImplementationAddressFromTable(contractAddress);
        try {
            const methodIds = await getMethodIdsByContractAddress(implementationAddress || contractAddress, JsonRpcProvider, web3HttpProvider);
            if (methodIds) {
                methodIdCache[contractAddress] = methodIds;
            }
            else {
                methodIdCache[contractAddress] = [];
                return null;
            }
        }
        catch (err) {
            console.log(err, "err getting methodIds for contract", implementationAddress || contractAddress, "implementationAddress", implementationAddress, "contractAddress", contractAddress);
        }
    }
    return methodIdCache[contractAddress];
}
function getMethodIdFromAbi(abiFunctionSignature) {
    const hash = keccak256(abiFunctionSignature);
    return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}
export const abiCache = {};
export async function getMethodIdsByContractAddress(contractAddress, JsonRpcProvider, web3HttpProvider) {
    // Fetch ABI for given contract address
    let abi = abiCache[contractAddress];
    if (!abi) {
        abi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider, web3HttpProvider);
        if (abi !== null && Array.isArray(abi)) {
            abiCache[contractAddress] = abi;
        }
        else {
            return null;
        }
    }
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