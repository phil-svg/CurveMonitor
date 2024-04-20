import Web3 from 'web3';
import { getAbiBy } from '../postgresTables/Abi.js';
import { getAddressById, getIdByAddress } from '../postgresTables/readFunctions/Pools.js';
import { readAbiFromAbisEthereumTable } from '../postgresTables/readFunctions/Abi.js';
import { WEB3_HTTP_PROVIDER, WEB3_WS_PROVIDER } from '../web3Calls/generic.js';
export function getWeb3WsProvider() {
    let web3WsProvider = null;
    const wsProvider = new Web3.providers.WebsocketProvider(process.env.WEB_WS_MAINNET);
    // Attach 'end' event listener
    wsProvider.on('end', (err) => {
        console.log('WS connection ended, reconnecting...', err);
        web3WsProvider = null; // Clear instance so that it can be recreated.
        getWeb3WsProvider(); // Recursive call to recreate the provider.
    });
    wsProvider.on('error', () => {
        console.error('WS encountered an error');
    });
    web3WsProvider = new Web3(wsProvider);
    return web3WsProvider;
}
export async function getWeb3HttpProvider() {
    let web3HttpProvider = null;
    const MAX_RETRIES = 5; // Maximum number of retries
    const RETRY_DELAY = 5000; // Delay between retries in milliseconds
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET));
            await web3HttpProvider.eth.net.isListening(); // This will throw an error if it can't connect
            return web3HttpProvider;
        }
        catch (error) {
            if (error instanceof Error) {
                const err = error;
                if (err.code === 'ECONNABORTED') {
                    console.log(`HTTP Provider connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else if (err.message && err.message.includes('CONNECTION ERROR')) {
                    console.log(`HTTP Provider connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else {
                    console.log(`Failed to connect to Ethereum node. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                retries++;
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    throw new Error('Failed to connect to Ethereum node after several attempts. Please check your connection and the status of the Ethereum node.');
}
export async function getContractByAddress(poolAddress) {
    const POOL_ID = await getIdByAddress(poolAddress);
    if (!POOL_ID) {
        console.log(`Err fetching ABI for pool ${poolAddress} in getContractByAddress`);
        return;
    }
    const CONTRACT = await getContractByPoolID(POOL_ID);
    return CONTRACT;
}
export async function getContractByAddressWithWebsocket(poolAddress) {
    const POOL_ID = await getIdByAddress(poolAddress);
    if (!POOL_ID) {
        console.log(`Err fetching ABI for pool ${poolAddress} in getContractByAddressWithWebsocket`);
        return;
    }
    const CONTRACT = await getContractByPoolIDWithWebsocket(POOL_ID);
    return CONTRACT;
}
export async function getContractByPoolIDWithWebsocket(poolId) {
    try {
        const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
        if (!POOL_ABI) {
            // console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolIDWithWebsocket`);
            return;
        }
        const POOL_ADDRESS = await getAddressById(poolId);
        if (!POOL_ADDRESS) {
            console.log(`Err fetching Address for pool ${poolId}`);
            return;
        }
        const CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
        return CONTRACT;
    }
    catch (err) {
        console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolIDWithWebsocket2`);
        return;
    }
}
export async function getContractByPoolID(poolId) {
    try {
        const POOL_ADDRESS = await getAddressById(poolId);
        if (!POOL_ADDRESS) {
            console.log(`Err fetching Address for pool ${poolId}`);
            return;
        }
        const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
        if (!POOL_ABI) {
            // console.log(`Err fetching ABI for pool ${poolId} ${POOL_ADDRESS} in getContractByPoolID_1`);
            return;
        }
        const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(POOL_ABI, POOL_ADDRESS);
        return CONTRACT;
    }
    catch (err) {
        console.log(`Err fetching ABI for pool ${poolId} in getContractByPoolID_2`);
        return;
    }
}
export async function getContractGlobalByAddress(address) {
    const abi = await readAbiFromAbisEthereumTable(address);
    if (!abi)
        return;
    return new WEB3_HTTP_PROVIDER.eth.Contract(abi, address);
}
export async function decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS) {
    const decodedLogs = [];
    for (const log of TOKEN_TRANSFER_EVENTS) {
        if (log.topics.length < 3)
            continue;
        const fromAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('address', log.topics[1]);
        const toAddress = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('address', log.topics[2]);
        const value = WEB3_HTTP_PROVIDER.eth.abi.decodeParameter('uint256', log.data);
        decodedLogs.push({
            tokenAddress: log.address,
            fromAddress,
            toAddress,
            value,
        });
    }
    return decodedLogs;
}
export function toChecksumAddress(address) {
    try {
        return Web3.utils.toChecksumAddress(address);
    }
    catch (err) {
        console.log('err in toChecksumAddress', err);
        return address;
    }
}
//# sourceMappingURL=Web3.js.map