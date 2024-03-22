import pkg from "js-sha3";
import { getImplementationAddressFromTable } from "../postgresTables/readFunctions/ProxyCheck.js";
import { updateAbiIWithProxyCheck } from "./ProxyCheck.js";
import { getAbiByForPools } from "../postgresTables/Abi.js";
import { getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
const { keccak256 } = pkg;
export async function getMethodId(contractAddress, JsonRpcProvider) {
    if (!contractAddress)
        return null;
    // Always fetch method IDs without checking the cache
    try {
        const implementationAddress = await getImplementationAddressFromTable(contractAddress);
        const methodIds = await getMethodIdsByContractAddress(implementationAddress || contractAddress, JsonRpcProvider);
        return methodIds || [];
    }
    catch (err) {
        console.log(err);
        return null;
    }
}
function getMethodIdFromAbi(abiFunctionSignature) {
    const hash = keccak256(abiFunctionSignature);
    return "0x" + hash.slice(0, 8); // Get the first 4 bytes (8 characters)
}
export const abiCache = {};
export async function getMethodIdsByContractAddress(contractAddress, JsonRpcProvider) {
    // Fetch ABI for given contract address
    let abi = abiCache[contractAddress];
    if (!abi) {
        abi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);
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
export async function getMethodIdsForPoolAddressLight(poolAddress) {
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