import { Op } from "sequelize";
import { AbisEthereum } from "../../models/Abi.js";
import { ProxyCheck } from "../../models/ProxyCheck.js";
import { WEB3_HTTP_PROVIDER, web3Call, web3CallLogFree } from "../web3Calls/generic.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { manualLaborProxyContracts } from "./ProxyContracts.js";
import { getAbiFromAbisEthereumTable, readAbiFromAbisEthereumTable, storeAbiInDb } from "../postgresTables/readFunctions/Abi.js";
import { NULL_ADDRESS } from "./Constants.js";
import { createProxyCheckRecord, findContractInProxyCheck } from "../postgresTables/readFunctions/ProxyCheck.js";
import { UnverifiedContracts } from "../../models/UnverifiedContracts.js";
export async function getImplementationContractAddressErc1967(proxyAddress, JsonRpcProvider) {
    const storagePosition = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    try {
        const implementationContractSlot = await JsonRpcProvider.getStorage(proxyAddress, storagePosition);
        const implementationContractAddress = "0x" + implementationContractSlot.slice(26);
        return implementationContractAddress;
    }
    catch (err) {
        return NULL_ADDRESS;
    }
}
export async function getImplementationContractAddressErc897(proxyAddress) {
    const ERCProxyABI = [
        {
            inputs: [],
            name: "implementation",
            outputs: [{ internalType: "address", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
    ];
    const proxyContract = new WEB3_HTTP_PROVIDER.eth.Contract(ERCProxyABI, proxyAddress);
    // const implementationContractAddress = await web3Call(proxyContract, "implementation", []);
    const implementationContractAddress = await web3CallLogFree(proxyContract, "implementation", []);
    return implementationContractAddress;
}
async function updateExistingProxyRecordFromManualList(existingProxyRecord, implementationAddress, standardsToCheck) {
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
async function fetchAndStoreAbi(implementationAddress) {
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
export async function updateProxiesFromManualList() {
    for (const entry of manualLaborProxyContracts) {
        const { proxyAddress, implementationAddress } = entry;
        const existingProxyRecord = await ProxyCheck.findOne({ where: { contractAddress: proxyAddress } });
        const standardsToCheck = ["EIP_1967", "EIP_897", "IMPLEMENTATION_FUNCTION"];
        if (existingProxyRecord) {
            updateExistingProxyRecordFromManualList(existingProxyRecord, implementationAddress, standardsToCheck);
        }
        else {
            await createProxyCheckRecord(proxyAddress, true, implementationAddress, standardsToCheck);
        }
        const existingAbiRecord = await getAbiFromAbisEthereumTable(implementationAddress);
        if (!existingAbiRecord) {
            await fetchAndStoreAbi(implementationAddress);
        }
    }
}
// Function to update 'checked_standards' in an existing ProxyCheck record
async function updateExistingProxyCheckStandards(existingRecord, standards) {
    // Ensure checked_standards is not null
    if (!existingRecord.checked_standards) {
        existingRecord.checked_standards = [];
    }
    // If record exists, append the standards if they're not present
    for (const standard of standards) {
        if (!existingRecord.checked_standards.includes(standard)) {
            existingRecord.checked_standards.push(standard);
        }
    }
    await existingRecord.save();
}
async function updateProxyCheckTable(contractAddress, isProxy, implementationAddress, standards) {
    // Find the record first
    const existingRecord = await ProxyCheck.findOne({
        where: {
            contractAddress: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    if (existingRecord) {
        updateExistingProxyCheckStandards(existingRecord, standards);
    }
    else {
        // If record doesn't exist, create it with the standards
        try {
            await createProxyCheckRecord(contractAddress, isProxy, implementationAddress, standards);
        }
        catch (err) {
            console.log("error in createProxyCheckRecord", err);
        }
    }
}
async function handleEIP1967(contractAddress, JsonRpcProvider) {
    const implementationAddress = await getImplementationContractAddressErc1967(contractAddress, JsonRpcProvider);
    if (implementationAddress !== NULL_ADDRESS) {
        await updateProxyCheckTable(contractAddress, true, implementationAddress, ["EIP_1967"]);
        return fetchAbiFromEtherscan(implementationAddress);
    }
    return null;
}
async function handleEIP897(contractAddress) {
    const implementationAddress = await getImplementationContractAddressErc897(contractAddress);
    if (implementationAddress) {
        await updateProxyCheckTable(contractAddress, true, implementationAddress, ["EIP_1967", "EIP_897"]);
        return fetchAbiFromEtherscan(implementationAddress);
    }
    return null;
}
async function handleImplementationFunction(contractAddress) {
    let abiRecord = await getAbiFromAbisEthereumTable(contractAddress);
    if (!abiRecord) {
        const fetchedAbi = await fetchAbiFromEtherscanOnly(contractAddress);
        if (fetchedAbi) {
            await storeAbiInDb(contractAddress, fetchedAbi);
        }
    }
    abiRecord = await getAbiFromAbisEthereumTable(contractAddress);
    if (!abiRecord)
        return null;
    const abi = abiRecord.abi;
    if (!abi)
        return null;
    // Check if the ABI contains a function named "implementation"
    const hasImplementationFunction = abi.some((entry) => entry.type === "function" && entry.name === "implementation");
    if (!hasImplementationFunction)
        return null;
    const contract = new WEB3_HTTP_PROVIDER.eth.Contract(abi, contractAddress);
    try {
        const implementationAddress = await web3Call(contract, "implementation", []);
        if (implementationAddress) {
            await updateProxyCheckTable(contractAddress, true, implementationAddress, ["EIP_1967", "EIP_897", "IMPLEMENTATION_FUNCTION"]);
            return fetchAbiFromEtherscan(implementationAddress);
        }
    }
    catch (err) {
        console.error(`Error calling 'implementation' function for contract ${contractAddress}: ${err}`);
    }
    return null;
}
// returns the ABI of the implementation contract
async function handleNewProxyScan(contractAddress, JsonRpcProvider) {
    let result = await handleEIP1967(contractAddress, JsonRpcProvider);
    if (result)
        return result; // proxy spotted
    result = await handleEIP897(contractAddress);
    if (result)
        return result; // proxy spotted
    result = await handleImplementationFunction(contractAddress);
    if (result)
        return result; // proxy spotted
    await updateProxyCheckTable(contractAddress, false, null, ["EIP_1967", "EIP_897", "IMPLEMENTATION_FUNCTION"]);
}
async function readAbiFromDb(contractAddress) {
    const existingAbi = await readAbiFromAbisEthereumTable(contractAddress);
    return existingAbi;
}
async function handleExistingProxyContract(contractRecord) {
    const implementationAddress = contractRecord.implementation_address;
    if (implementationAddress) {
        const existingAbi = await readAbiFromAbisEthereumTable(implementationAddress);
        if (existingAbi) {
            return existingAbi;
        }
    }
    return fetchAbiFromEtherscan(implementationAddress || contractRecord.contractAddress);
}
// Function to fetch ABI from Etherscan
export async function fetchAbiFromEtherscanOnly(contractAddress) {
    const fetchedAbi = await fetchAbiFromEtherscan(contractAddress);
    if (fetchedAbi && fetchedAbi.length > 0) {
        return fetchedAbi;
    }
    return null;
}
/**
 * Fetches the ABI for the given contract address.
 *
 * @param contractAddress - The contract address for which the ABI is required.
 * @returns The ABI as a JSON array.
 */
export async function updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider) {
    const contractAddressLower = contractAddress.toLowerCase(); // Convert contract address to lowercase
    const existingAbi = await readAbiFromDb(contractAddressLower);
    if (existingAbi) {
        return existingAbi;
    }
    const contractRecord = await findContractInProxyCheck(contractAddressLower);
    if (contractRecord && contractRecord.is_proxy_contract) {
        let abi = await handleExistingProxyContract(contractRecord);
        return abi;
    }
    // if (contractRecord) {
    //   if (contractRecord.is_proxy_contract) {
    //     let abi = await handleExistingProxyContract(contractRecord);
    //     return abi;
    //   } else {
    //     return null;
    //   }
    // }
    // Check if contractAddress exists in the UnverifiedContracts table, case insensitively
    const unverifiedContract = await UnverifiedContracts.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddressLower,
            },
        },
    });
    // console.log("unverifiedContract", unverifiedContract);
    if (unverifiedContract) {
        return null; // Return null if contract is in unverified contracts list
    }
    // If the contract is not a proxy, or if it doesn't exist in the new table
    if (!contractRecord) {
        // console.log("doing handleNewProxyScan");
        let abi = await handleNewProxyScan(contractAddressLower, JsonRpcProvider);
        if (abi)
            return abi;
    }
    const existingAbiNow = await readAbiFromDb(contractAddressLower);
    if (existingAbiNow)
        return existingAbiNow;
    // console.log("doing fetchAbiFromEtherscanOnly");
    const fetchedAbi = await fetchAbiFromEtherscanOnly(contractAddressLower);
    if (fetchedAbi) {
        await storeAbiInDb(contractAddressLower, fetchedAbi);
        return fetchedAbi;
    }
    else {
        // Contract not verified; add to the UnverifiedContracts table
        await UnverifiedContracts.upsert({
            contract_address: contractAddressLower,
        });
    }
    return null;
}
//# sourceMappingURL=ProxyCheck.js.map