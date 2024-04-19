import { Op, QueryTypes } from 'sequelize';
import { AbisEthereum } from '../../models/Abi.js';
import { ProxyCheck } from '../../models/ProxyCheck.js';
import { WEB3_HTTP_PROVIDER, web3Call, web3CallLogFree } from '../web3Calls/generic.js';
import { fetchAbiFromEtherscan } from '../postgresTables/Abi.js';
import { manualLaborProxyContracts } from './ProxyContracts.js';
import { contractAbiExistsInTable, getAbiFromAbisEthereumTable, getAbiFromDbClean, readAbiFromAbisEthereumTable, storeAbiInDb, } from '../postgresTables/readFunctions/Abi.js';
import { NULL_ADDRESS } from './Constants.js';
import { createProxyCheckRecord, findContractInProxyCheck } from '../postgresTables/readFunctions/ProxyCheck.js';
import { UnverifiedContracts } from '../../models/UnverifiedContracts.js';
import { sequelize } from '../../config/Database.js';
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
    let wasProcessed = await proxySearchWasDoneBeforeOld(contractAddress);
    if (wasProcessed)
        return;
    const contractRecord = await findContractInProxyCheck(contractAddressLower);
    if (contractRecord && contractRecord.is_proxy_contract) {
        let abi = await handleExistingProxyContract(contractRecord);
        return abi;
    }
    // Check if contractAddress exists in the UnverifiedContracts table, case insensitively
    const unverifiedContract = await UnverifiedContracts.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddressLower,
            },
        },
    });
    if (unverifiedContract) {
        return null; // Return null if contract is in unverified contracts list
    }
    // If the contract is not a proxy, or if it doesn't exist in the new table
    if (!contractRecord) {
        let abi = await handleNewProxyScan(contractAddressLower, JsonRpcProvider);
        if (abi)
            return abi;
    }
    const existingAbiNow = await readAbiFromDb(contractAddressLower);
    if (existingAbiNow)
        return existingAbiNow;
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
export async function getImplementationContractAddressErc1967(proxyAddress, JsonRpcProvider) {
    const storagePosition = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    try {
        const implementationContractSlot = await JsonRpcProvider.getStorage(proxyAddress, storagePosition);
        const implementationContractAddress = '0x' + implementationContractSlot.slice(26);
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
            name: 'implementation',
            outputs: [{ internalType: 'address', name: '', type: 'address' }],
            stateMutability: 'view',
            type: 'function',
        },
    ];
    const proxyContract = new WEB3_HTTP_PROVIDER.eth.Contract(ERCProxyABI, proxyAddress);
    const implementationContractAddress = await web3CallLogFree(proxyContract, 'implementation', []);
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
        const standardsToCheck = ['EIP_1967', 'EIP_897', 'IMPLEMENTATION_FUNCTION'];
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
async function proxySearchWasDoneBeforeOld(contractAddress) {
    const existingRecord = await ProxyCheck.findOne({
        where: {
            contractAddress: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    if (existingRecord)
        return true;
    return false;
}
/**
 * Checks if a proxy search was done before for a given contract address in the proxy_checks table.
 * @param contractAddress The address of the contract to check.
 * @returns A Promise resolving to true if the search was done before, otherwise false.
 */
async function proxySearchWasDoneBefore(contractAddress) {
    contractAddress = contractAddress.toLowerCase();
    const query = `
    SELECT EXISTS (
      SELECT 1
      FROM proxy_checks
      WHERE "contractAddress" = :contractAddress
    ) AS exists;
  `;
    try {
        const results = await sequelize.query(query, {
            replacements: { contractAddress },
            type: QueryTypes.SELECT,
            raw: true,
        });
        return results[0].exists;
    }
    catch (error) {
        console.error(`Error checking if proxy search was done before for ${contractAddress}: ${error}`);
        return false;
    }
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
            console.log('error in createProxyCheckRecord', err);
        }
    }
}
async function handleEIP1967(contractAddress, JsonRpcProvider) {
    const implementationAddress = await getImplementationContractAddressErc1967(contractAddress, JsonRpcProvider);
    if (implementationAddress !== NULL_ADDRESS) {
        await updateProxyCheckTable(contractAddress, true, implementationAddress, ['EIP_1967']);
        return fetchAbiFromEtherscan(implementationAddress);
    }
    return null;
}
async function handleEIP897(contractAddress) {
    const implementationAddress = await getImplementationContractAddressErc897(contractAddress);
    if (implementationAddress) {
        await updateProxyCheckTable(contractAddress, true, implementationAddress, ['EIP_1967', 'EIP_897']);
        const fetchedAbi = await fetchAbiFromEtherscanOnly(contractAddress);
        if (fetchedAbi) {
            await storeAbiInDb(contractAddress, fetchedAbi);
            return fetchedAbi;
        }
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
        else {
            await UnverifiedContracts.upsert({
                contract_address: contractAddress.toLowerCase(),
            });
        }
    }
    abiRecord = await getAbiFromAbisEthereumTable(contractAddress);
    if (!abiRecord)
        return null;
    const abi = abiRecord.abi;
    if (!abi)
        return null;
    // Check if the ABI contains a function named "implementation"
    const hasImplementationFunction = abi.some((entry) => entry.type === 'function' && entry.name === 'implementation');
    if (!hasImplementationFunction)
        return null;
    try {
        const contract = new WEB3_HTTP_PROVIDER.eth.Contract(abi, contractAddress);
        const implementationAddress = await web3Call(contract, 'implementation', []);
        if (implementationAddress) {
            await updateProxyCheckTable(contractAddress, true, implementationAddress, [
                'EIP_1967',
                'EIP_897',
                'IMPLEMENTATION_FUNCTION',
            ]);
            return fetchAbiFromEtherscan(implementationAddress);
        }
    }
    catch (err) {
        console.error(`Error calling 'implementation' function for contract ${contractAddress}: ${err}`);
    }
    return null;
}
// returns the ABI of the implementation contract
export async function handleNewProxyScan(contractAddress, JsonRpcProvider) {
    let result = await handleEIP1967(contractAddress, JsonRpcProvider); // handleEIP1967: 263.509ms
    if (result)
        return result; // proxy spotted
    result = await handleEIP897(contractAddress); // handleEIP897: 183.961ms
    if (result)
        return result; // proxy spotted
    result = await handleImplementationFunction(contractAddress); // handleImplementationFunction: 705.871ms
    if (result)
        return result; // proxy spotted
    await updateProxyCheckTable(contractAddress, false, null, ['EIP_1967', 'EIP_897', 'IMPLEMENTATION_FUNCTION']);
}
async function readAbiFromDb(contractAddress) {
    const existingAbi = await readAbiFromAbisEthereumTable(contractAddress);
    return existingAbi;
}
// Function to fetch ABI from Etherscan
export async function fetchAbiFromEtherscanOnly(contractAddress) {
    const fetchedAbi = await fetchAbiFromEtherscan(contractAddress);
    if (fetchedAbi && fetchedAbi.length > 0) {
        return fetchedAbi;
    }
    return null;
}
async function handleExistingProxyContract(contractRecord) {
    const implementationAddress = contractRecord.implementation_address;
    if (implementationAddress) {
        const existingAbi = await readAbiFromAbisEthereumTable(implementationAddress);
        if (existingAbi)
            return existingAbi;
    }
    return fetchAbiFromEtherscan(implementationAddress || contractRecord.contractAddress);
}
/**
 * Fetches the ABI for the given contract address. Now with Speed
 *
 * @param contractAddress - The contract address for which the ABI is required.
 */
export async function updateAbiIWithProxyCheckClean(contractAddress, JsonRpcProvider) {
    const contractAddressLower = contractAddress.toLowerCase();
    let abi = await contractAbiExistsInTable(contractAddressLower);
    if (abi)
        return;
    let wasProcessed = await proxySearchWasDoneBefore(contractAddress);
    if (wasProcessed)
        return;
    const contractRecord = await findContractInProxyCheck(contractAddressLower);
    if (contractRecord && contractRecord.is_proxy_contract) {
        abi = await handleExistingProxyContract(contractRecord);
        if (!abi) {
            await UnverifiedContracts.upsert({
                contract_address: contractAddressLower,
            });
        }
        return;
    }
    // Check if contractAddress exists in the UnverifiedContracts table, case insensitively
    let unverifiedContract = await UnverifiedContracts.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddressLower,
            },
        },
    });
    if (unverifiedContract)
        return;
    // If the contract is not a proxy, or if it doesn't exist in the new table
    if (!contractRecord) {
        let abi = await handleNewProxyScan(contractAddressLower, JsonRpcProvider);
        if (abi)
            return abi;
    }
    const existingAbiNow = await getAbiFromDbClean(contractAddressLower);
    if (existingAbiNow)
        return;
    // Check if contractAddress exists in the UnverifiedContracts table, case insensitively
    unverifiedContract = await UnverifiedContracts.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddressLower,
            },
        },
    });
    if (unverifiedContract)
        return;
    const fetchedAbi = await fetchAbiFromEtherscanOnly(contractAddressLower);
    if (fetchedAbi) {
        await storeAbiInDb(contractAddressLower, fetchedAbi);
        return;
    }
    else {
        // Contract not verified; add to the UnverifiedContracts table
        await UnverifiedContracts.upsert({
            contract_address: contractAddressLower,
        });
    }
    return;
}
//# sourceMappingURL=ProxyCheck.js.map