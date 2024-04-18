import { AbisPools, AbisRelatedToAddressProvider } from '../../models/Abi.js';
import axios, { AxiosError } from 'axios';
import { getAddressById, getAllPoolIds } from './readFunctions/Pools.js';
import { NULL_ADDRESS } from '../helperFunctions/Constants.js';
import Bottleneck from 'bottleneck';
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
        throw new Error('You must provide either an address or a pool id');
    }
};
// Fetches the ABI record for the given address or id from the AbisPools table.
export const getAbiByForPools = async (options) => {
    if (!options.id) {
        return null;
    }
    const abiRecord = await AbisPools.findOne({ where: { pool_id: options.id } });
    return abiRecord ? abiRecord.abi : null;
};
// Fetches the ABI record for the given address or id from the AbisRelatedToAddressProvider table.
export const getAbiByForAddressProvider = async (options) => {
    const address = await resolveAddress(options);
    if (!address) {
        return null;
    }
    const abiRecord = await AbisRelatedToAddressProvider.findOne({ where: { address } });
    return abiRecord ? abiRecord.abi : null;
};
const etherscanLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 200, // Minimum time between requests
});
// this function returning null means sc not verified
export async function fetchAbiFromEtherscan(address) {
    // console.log("Called fetchAbiFromEtherscan for contract", address);
    if (!address || address === NULL_ADDRESS)
        return null;
    const URL = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_KEY}`;
    const fetchAbi = async (retryCount = 0, maxRetries = 10) => {
        var _a, _b, _c;
        try {
            const response = await axios.get(URL, { timeout: 30000 });
            return response.data.result;
        }
        catch (error) {
            if (error instanceof AxiosError &&
                (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' ||
                    error.code === 'ECONNABORTED' ||
                    error.code === 'ECONNRESET' ||
                    ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 503 || // Service Unavailable
                    ((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 502 || // Bad Gateway
                    ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 429) && // Too Many Requests (Rate Limiting)
                retryCount < maxRetries) {
                const delayTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
                await new Promise((resolve) => setTimeout(resolve, delayTime));
                return fetchAbi(retryCount + 1, maxRetries);
            }
            else {
                throw error;
            }
        }
    };
    const ABIString = await etherscanLimiter.schedule(() => fetchAbi());
    if (ABIString === 'Contract source code not verified')
        return null;
    try {
        return JSON.parse(ABIString);
    }
    catch (err) {
        return null;
    }
}
// Checks if ABI is stored in the specified table
export async function isAbiStored(tableName, address) {
    const lowerCaseAddress = address.toLowerCase();
    let abiRecord;
    if (tableName === 'AbisPools') {
        abiRecord = await AbisPools.findOne({ where: { address: lowerCaseAddress } });
    }
    if (tableName === 'AbisRelatedToAddressProvider') {
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
    }
    catch (err) {
        console.error('Error storing abi for AbisPools:', err);
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
    }
    catch (err) {
        console.error('Error storing abi for AbisRelatedToAddressProvider:', err);
    }
}
// Main function to retrieve the ABI based on the provided table name and input options.
export async function getAbiBy(tableName, options) {
    if (!options.address && !options.id) {
        console.error('Error: Both address and id are not provided.');
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
    try {
        if (tableName === 'AbisPools') {
            abi = await getAbiByForPools(options);
        }
        else if (tableName === 'AbisRelatedToAddressProvider') {
            abi = await getAbiByForAddressProvider(options);
        }
        else {
            console.error(`Error: Invalid table name "${tableName}".`);
            return null;
        }
        if (!abi) {
            abi = await fetchAbiFromEtherscan(address);
            if (options.id && abi) {
                await storeAbiForPools(options.id, abi);
            }
            else if (options.address && abi) {
                await storeAbiForAddressProvider(options.address, abi);
            }
            else {
                // console.error("Missing pool_id or abi to store the ABI in AbisPools", options, "abi:", abi);
            }
        }
        return abi;
    }
    catch (err) {
        if (err instanceof Error) {
            // console.log("Contract source code probably not verified for pool", address, err.message);
        }
        else {
            console.error('Error retrieving ABI:', err);
        }
        return null;
    }
}
export async function fetchMissingPoolAbisFromEtherscan() {
    const limit = 5; // adjust according to API rate limit
    const delayInMilliseconds = 1000; // adjust delay time based API rules and rate limit
    // Get all pool_ids from the database
    const allPoolIdsInDB = await AbisPools.findAll({ attributes: ['pool_id'] });
    const allPoolIdsInDBArray = allPoolIdsInDB.map((pool) => pool.pool_id);
    // Get all pool_ids
    const ALL_POOL_IDS = (await getAllPoolIds()).sort((a, b) => a - b);
    // Find missing pool_ids
    const missingPoolIds = ALL_POOL_IDS.filter((poolId) => !allPoolIdsInDBArray.includes(poolId));
    // console.log("Fetching ABIs from Etherscan..");
    // Fetch and store missing ABIs
    for (let i = 0; i < missingPoolIds.length; i += limit) {
        const poolIdsSegment = missingPoolIds.slice(i, i + limit);
        const promises = poolIdsSegment.map(async (poolId) => {
            const address = await getAddressById(poolId); // Get the pool address by its id
            if (address === null) {
                console.error(`Error: Address for poolId ${poolId} is null.`);
                return;
            }
            try {
                const abi = await fetchAbiFromEtherscan(address);
                if (abi) {
                    await storeAbiForPools(poolId, abi);
                }
            }
            catch (err) {
                console.log('err fetching abi for ', address, err);
            }
        });
        await Promise.all(promises);
        // Delay to avoid hitting rate limit
        if (i + limit < missingPoolIds.length) {
            await new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
        }
    }
}
export async function updatePoolAbis() {
    await fetchMissingPoolAbisFromEtherscan();
    console.log(`[✓] Pool-ABIs' synced successfully.`);
}
import { decode } from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';
import { base58btc } from 'multiformats/bases/base58';
async function getContractABIfromMetadata(contractAddress) {
    try {
        // Step 1: Retrieve the contract bytecode
        console.time();
        const response = await axios.post(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`, {
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_getCode',
            params: [contractAddress, 'latest'],
        }, {
            timeout: 1000,
        });
        console.timeEnd();
        const bytecode = response.data.result;
        // Step 2: Decode the CBOR-encoded metadata hash from the bytecode
        const cborLength = parseInt(bytecode.slice(-4), 16) * 2;
        const cborData = bytecode.slice(-cborLength - 4, -4);
        const decodedCbor = decode(Buffer.from(cborData, 'hex'));
        const metadataHashBytes = decodedCbor.ipfs;
        // Convert the byte array to a valid IPFS hash (CIDv0)
        const metadataHash = CID.decode(metadataHashBytes).toString(base58btc);
        // Step 3: Retrieve the metadata file from IPFS
        console.log(`https://ipfs.io/ipfs/${metadataHash}`);
        console.time();
        const metadataResponse = await axios.get(`https://ipfs.io/ipfs/${metadataHash}`);
        console.timeEnd();
        const metadata = metadataResponse.data;
        // Step 4: Extract the ABI from the metadata
        const abi = metadata.output.abi;
        return abi;
    }
    catch (error) {
        console.error('Error retrieving contract ABI:', error);
        throw error;
    }
}
export async function updateAbisFromTxTraces() {
    console.log('hello world');
    const contractAddress = '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad';
    const abi = await getContractABIfromMetadata(contractAddress);
    // console.log(abi);
    console.log('done');
}
//# sourceMappingURL=Abi.js.map