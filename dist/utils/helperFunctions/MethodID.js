import pkg from "js-sha3";
import { getAbiFromAbisEthereum, readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { AbisEthereum } from "../../models/Abi.js";
import { manualLaborProxyContracts } from "./ProxyContracts.js";
import { ProxyCheck } from "../../models/ProxyCheck.js";
import { getProxyImplementationAddress } from "../postgresTables/readFunctions/ProxyCheck.js";
import { Op } from "sequelize";
const { keccak256 } = pkg;
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function updateAbisFromTrace(transactionTraces) {
    await updateProxiesFromManualList();
    const processedAddresses = new Set();
    let fetchPromises = [];
    for (const trace of transactionTraces) {
        let contractAddress = trace.action.to;
        if (!contractAddress || processedAddresses.has(contractAddress))
            continue;
        // checking if the contract is a proxy
        const implementationAddress = await getProxyImplementationAddress(contractAddress);
        if (implementationAddress) {
            contractAddress = implementationAddress; // using implementation address if it's a proxy
        }
        let existingRecord = await getAbiFromAbisEthereum(contractAddress);
        if (!existingRecord || (existingRecord.is_verified !== null && !existingRecord.abi)) {
            fetchPromises.push(handleFetch(contractAddress));
            if (fetchPromises.length === 5) {
                await Promise.all(fetchPromises);
                fetchPromises = [];
                await delay(1000); // ensuring a 1-second delay between batches
            }
        }
        processedAddresses.add(contractAddress);
    }
    if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
    }
}
async function handleFetch(contractAddress) {
    const fetchedAbi = await fetchAbiFromEtherscan(contractAddress);
    if (fetchedAbi === null) {
        // unverified contract
        await AbisEthereum.update({ is_verified: false }, { where: { contract_address: contractAddress } });
    }
    else if (fetchedAbi.length) {
        try {
            await AbisEthereum.create({
                contract_address: contractAddress,
                abi: fetchedAbi,
                is_verified: true,
            });
        }
        catch (err) {
            console.log(`Error storing Abi in AbisEthereum ${err}`);
        }
    }
}
export async function updateProxiesFromManualList() {
    for (const entry of manualLaborProxyContracts) {
        const { proxyAddress, implementationAddress } = entry;
        const existingProxyRecord = await ProxyCheck.findOne({ where: { contractAddress: proxyAddress } });
        const standardsToCheck = ["EIP_1967", "EIP_897"];
        if (existingProxyRecord) {
            if (existingProxyRecord.implementation_address !== implementationAddress) {
                // Update the record if the implementation address is different
                existingProxyRecord.implementation_address = implementationAddress;
                existingProxyRecord.is_proxy_contract = true; // Mark it as a proxy
                // If checked_standards is null, initialize it as an empty array
                if (!existingProxyRecord.checked_standards) {
                    existingProxyRecord.checked_standards = [];
                }
                // Check and add standards without duplicating
                for (const standard of standardsToCheck) {
                    if (!existingProxyRecord.checked_standards.includes(standard)) {
                        existingProxyRecord.checked_standards.push(standard);
                    }
                }
                await existingProxyRecord.save();
            }
        }
        else {
            // If the proxy address is not found in the table, insert a new record
            await ProxyCheck.create({
                contractAddress: proxyAddress,
                is_proxy_contract: true,
                implementation_address: implementationAddress,
                checked_standards: standardsToCheck,
            });
        }
        // Check if the implementationAddress has an entry in abis_ethereum table
        const existingAbiRecord = await AbisEthereum.findOne({
            where: {
                contract_address: {
                    [Op.iLike]: implementationAddress,
                },
            },
        });
        if (!existingAbiRecord) {
            // Fetch ABI from Etherscan if not found in the table
            const fetchedAbi = await fetchAbiFromEtherscan(implementationAddress);
            if (fetchedAbi) {
                try {
                    await AbisEthereum.create({
                        contract_address: implementationAddress,
                        abi: fetchedAbi,
                        is_verified: true, // Assuming it's verified if successfully fetched
                    });
                }
                catch (err) {
                    console.error(`Error storing ABI in AbisEthereum for ${implementationAddress}: ${err}`);
                }
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