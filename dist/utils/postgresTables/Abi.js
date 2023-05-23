import { AbisPools, AbisRelatedToAddressProvider } from "../../models/Abi.js";
import axios, { AxiosError } from "axios";
import { getAddressById, getAllPoolIds } from "./readFunctions/Pools.js";
const resolveAddress = async (options) => {
    if (options.address) {
        return options.address.toLowerCase();
    }
    else if (options.id) {
        const address = await getAddressById(options.id);
        if (!address) {
            console.error(`Error: Pool with id ${options.id} not found.`);
        }
        return address;
    }
    else {
        throw new Error("You must provide either an address or a pool id");
    }
};
// Fetches the ABI record for the given address or id from the AbisPools table.
const getAbiByForPools = async (options) => {
    if (!options.id) {
        return null;
    }
    const abiRecord = await AbisPools.findOne({ where: { pool_id: options.id } });
    return abiRecord ? abiRecord.abi : null;
};
// Fetches the ABI record for the given address or id from the AbisRelatedToAddressProvider table.
const getAbiByForAddressProvider = async (options) => {
    const address = await resolveAddress(options);
    if (!address) {
        return null;
    }
    const abiRecord = await AbisRelatedToAddressProvider.findOne({ where: { address } });
    return abiRecord ? abiRecord.abi : null;
};
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Fetches ABI from Etherscan
export async function fetchAbiFromEtherscan(address) {
    const URL = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_KEY}`;
    const MAX_RETRIES = 12;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const ABI = (await axios.get(URL)).data.result;
            return JSON.parse(ABI);
        }
        catch (error) {
            if (error instanceof AxiosError && error.response && error.response.status === 429) {
                // HTTP 429 Too Many Requests
                console.log(`Attempt ${attempt} failed, retrying in ${attempt * 2} seconds...`);
                await delay(attempt * 2000);
            }
            else {
                throw error; // if the error is something else, rethrow it.
            }
        }
    }
    throw new Error(`Failed to fetch ABI from Etherscan after ${MAX_RETRIES} attempts.`);
}
// Checks if ABI is stored in the specified table
export async function isAbiStored(tableName, address) {
    const lowerCaseAddress = address.toLowerCase();
    let abiRecord;
    if (tableName === "AbisPools") {
        abiRecord = await AbisPools.findOne({ where: { address: lowerCaseAddress } });
    }
    if (tableName === "AbisRelatedToAddressProvider") {
        abiRecord = await AbisRelatedToAddressProvider.findOne({ where: { address: lowerCaseAddress } });
    }
    return abiRecord !== null;
}
async function storeAbiForPools(pool_id, abi) {
    try {
        const existingAbi = await AbisPools.findOne({ where: { pool_id } });
        if (existingAbi) {
            return; // Abi for the pool_id is already stored.
        }
        await AbisPools.create({ pool_id, abi });
        console.log(`Abi for pool_id ${pool_id} stored successfully`);
    }
    catch (err) {
        console.error("Error storing abi for AbisPools:", err);
    }
}
export async function storeAbiForAddressProvider(address, abi) {
    try {
        const lowerCaseAddress = address.toLowerCase();
        const existingAbi = await AbisRelatedToAddressProvider.findOne({ where: { address: lowerCaseAddress } });
        if (existingAbi) {
            return; // Abi for the address is already stored.
        }
        await AbisRelatedToAddressProvider.create({ address: lowerCaseAddress, abi });
        console.log(`Abi for ${address} stored successfully`);
    }
    catch (err) {
        console.error("Error storing abi for AbisRelatedToAddressProvider:", err);
    }
}
// Main function to retrieve the ABI based on the provided table name and input options.
export async function getAbiBy(tableName, options) {
    try {
        if (!options.address && !options.id) {
            console.error("Error: Both address and id are not provided.");
            return null;
        }
        if (options.address) {
            options.address = options.address.toLowerCase();
        }
        const address = await resolveAddress(options);
        if (!address) {
            return null;
        }
        let abi;
        if (tableName === "AbisPools") {
            abi = await getAbiByForPools(options);
        }
        else if (tableName === "AbisRelatedToAddressProvider") {
            abi = await getAbiByForAddressProvider(options);
        }
        else {
            console.error(`Error: Invalid table name "${tableName}".`);
            return null;
        }
        if (!abi) {
            abi = await fetchAbiFromEtherscan(address);
            if (options.id) {
                await storeAbiForPools(options.id, abi);
            }
            else {
                console.error("Error: Missing pool_id to store the ABI in AbisPools table");
            }
        }
        return abi;
    }
    catch (err) {
        console.error("Error retrieving ABI:", err);
        return null;
    }
}
export async function updatePoolAbis() {
    const ALL_POOL_IDS = (await getAllPoolIds()).sort((a, b) => a - b);
    let i = 0;
    for (const POOL_ID of ALL_POOL_IDS) {
        i += 1;
        await getAbiBy("AbisPools", { id: POOL_ID });
    }
    console.log(`[✓] Table: ABIs  | Pool-ABIs' synced successfully.`);
}
//# sourceMappingURL=Abi.js.map