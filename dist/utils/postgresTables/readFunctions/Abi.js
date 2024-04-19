import { Op, QueryTypes } from 'sequelize';
import { AbisEthereum } from '../../../models/Abi.js';
import { sequelize } from '../../../config/Database.js';
export async function readAbiFromAbisEthereumTable(contractAddress) {
    const record = await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    // Return the ABI if found, otherwise return null
    return record ? record.abi : null;
}
export async function getAbiFromAbisEthereumTable(contractAddress) {
    return await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.eq]: contractAddress.toLowerCase(),
            },
        },
    });
}
export async function isContractVerified(contractAddress) {
    const record = await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    return record ? record.is_verified === true : false;
}
export async function storeAbiInDb(contractAddress, abi) {
    try {
        await AbisEthereum.create({
            contract_address: contractAddress,
            abi,
        });
    }
    catch (err) {
        console.log(`Error storing Abi in AbisEthereum ${err}`);
    }
}
/**
 * Fetches the ABI for a contract, considering whether it's a proxy.
 * @param contractAddress The address of the contract to fetch ABI for.
 * @returns A Promise resolving to the ABI or null if not found or not applicable.
 */
export async function getAbiFromDbClean(contractAddress) {
    contractAddress = contractAddress.toLowerCase();
    // SQL to check if the contract address is a proxy
    const proxyCheckQuery = `
    SELECT "contractAddress", "is_proxy_contract", "implementation_address"
    FROM proxy_checks 
    WHERE "contractAddress" = :contractAddress;
  `;
    const proxyChecks = await sequelize.query(proxyCheckQuery, {
        replacements: { contractAddress },
        type: QueryTypes.SELECT,
        raw: true,
    });
    // Handle no entry found
    const proxyCheck = proxyChecks[0];
    if (!proxyCheck)
        return null;
    // Determine the correct address to query the ABI from
    const addressToQuery = proxyCheck.is_proxy_contract ? proxyCheck.implementation_address : contractAddress;
    // Return null if no implementation address is provided for proxy contracts
    if (proxyCheck.is_proxy_contract && !addressToQuery)
        return null;
    // SQL to query the ABI from the abis_ethereum table using the correct address
    const abiQuery = `
    SELECT "abi"
    FROM abis_ethereum 
    WHERE "contract_address" = :addressToQuery;
  `;
    const abiResults = await sequelize.query(abiQuery, {
        replacements: { addressToQuery },
        type: QueryTypes.SELECT,
        raw: true,
    });
    // Return the ABI or null if not found
    const abiEntry = abiResults[0];
    return abiEntry ? abiEntry.abi : null;
}
/**
 * Checks if an ABI exists for a given contract address in the abis_ethereum table.
 * @param contractAddress The address of the contract to check for an ABI.
 * @returns A Promise resolving to true if the ABI exists, otherwise false.
 */
export async function contractAbiExistsInTable(contractAddress) {
    const query = `
    SELECT EXISTS (
      SELECT 1
      FROM abis_ethereum
      WHERE contract_address = :contractAddress
    ) AS exists;
  `;
    try {
        const results = await sequelize.query(query, {
            replacements: { contractAddress },
            type: QueryTypes.SELECT,
            raw: true,
        });
        // Since the query uses EXISTS, it will return an array with one object containing the exists key
        return results[0].exists;
    }
    catch (error) {
        console.error(`Error checking ABI existence for contract address ${contractAddress}: ${error}`);
        return false; // Return false on error
    }
}
//# sourceMappingURL=Abi.js.map