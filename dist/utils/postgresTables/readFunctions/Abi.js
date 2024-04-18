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
//# sourceMappingURL=Abi.js.map