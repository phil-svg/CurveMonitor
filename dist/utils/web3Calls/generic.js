import { getWeb3HttpProvider, getWeb3WsProvider } from '../helperFunctions/Web3.js';
import axios from 'axios';
import Bottleneck from 'bottleneck';
import { ABI_TRANSFER } from '../helperFunctions/Erc20Abis.js';
import { findCoinAddressById } from '../postgresTables/readFunctions/Coins.js';
import { getTxHashByTxId } from '../postgresTables/readFunctions/Transactions.js';
import axiosRetry from 'axios-retry';
export let WEB3_HTTP_PROVIDER = await getWeb3HttpProvider();
export let WEB3_WS_PROVIDER = getWeb3WsProvider();
// export const WEB3_HTTP_PROVIDER = "no internet";
// export const WEB3_WS_PROVIDER = "no internet";
export async function bootWsProvider() {
    WEB3_WS_PROVIDER = getWeb3WsProvider();
    console.log('WebSocket Provider connected.');
}
function isCupsErr(err) {
    return err.message.includes('compute units per second capacity');
}
function isError(err) {
    return err instanceof Error;
}
async function delay() {
    await new Promise((resolve) => setTimeout(resolve, 280));
}
async function randomDelay() {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
}
export async function getCurrentBlockNumber() {
    let shouldContinue = true;
    let retries = 0;
    const maxRetries = 12;
    let blockNumber = null;
    while (shouldContinue && retries < maxRetries && !blockNumber) {
        try {
            blockNumber = await WEB3_HTTP_PROVIDER.eth.getBlockNumber();
        }
        catch (error) {
            if (isError(error) && isCupsErr(error)) {
                await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
            }
            else {
                if (isError(error)) {
                    console.log('Error in getCurrentBlockNumber', blockNumber, error.message);
                }
                else {
                    console.log('Error in getCurrentBlockNumber', blockNumber, 'Unknown error');
                }
                shouldContinue = false;
            }
        }
        retries++;
        if (!blockNumber && shouldContinue) {
            await delay();
        }
    }
    return blockNumber;
}
export async function getPastEvents(CONTRACT, eventName, fromBlock, toBlock) {
    if (fromBlock === null || toBlock === null) {
        return null;
    }
    let retries = 0;
    const maxRetries = 12;
    let EVENT_ARRAY = [];
    while (retries < maxRetries) {
        try {
            const events = await CONTRACT.getPastEvents(eventName, { fromBlock, toBlock });
            for (const DATA of events) {
                EVENT_ARRAY.push(DATA);
            }
            break;
        }
        catch (error) {
            if (isError(error) && isCupsErr(error)) {
                await randomDelay();
            }
            else {
                const errorString = error.toString();
                if (errorString.includes('Log response size exceeded.')) {
                    const matchResult = errorString.match(/\[.*\]/g);
                    if (matchResult) {
                        const recommendedBlockRange = matchResult[0];
                        const [start, end] = recommendedBlockRange
                            .slice(1, -1)
                            .split(', ')
                            .map((x) => parseInt(x, 16));
                        return { start, end };
                    }
                }
                throw error;
            }
        }
        retries++;
        if (EVENT_ARRAY.length === 0) {
            await delay();
        }
    }
    return EVENT_ARRAY;
}
export async function getTokenTransferEvents(WEB3_HTTP_PROVIDER, coinID, blockNumber) {
    const COIN_ADDRESS = await findCoinAddressById(coinID);
    const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_TRANSFER, COIN_ADDRESS);
    return await getPastEvents(CONTRACT, 'Transfer', blockNumber, blockNumber);
}
export async function web3Call(CONTRACT, method, params, blockNumber = { block: 'latest' }) {
    let shouldContinue = true;
    let retries = 0;
    while (shouldContinue && retries < 12) {
        try {
            return await CONTRACT.methods[method](...params).call(blockNumber);
        }
        catch (error) {
            if (isError(error) && !isCupsErr(error)) {
                console.log(`${error} | Contract: ${CONTRACT.options.address} | method: ${method} | params: ${params} | blockNumber: ${blockNumber}`);
                shouldContinue = false;
            }
            else {
                await randomDelay();
            }
        }
        retries++;
        if (shouldContinue) {
            await delay();
        }
    }
}
export async function web3CallLogFree(CONTRACT, method, params, blockNumber = { block: 'latest' }) {
    let shouldContinue = true;
    let retries = 0;
    while (shouldContinue && retries < 12) {
        try {
            return await CONTRACT.methods[method](...params).call(blockNumber);
        }
        catch (error) {
            if (isError(error) && !isCupsErr(error)) {
                shouldContinue = false;
            }
            else {
                await randomDelay();
            }
        }
        retries++;
        if (shouldContinue) {
            await delay();
        }
    }
}
export async function getBlockTimeStamp(blockNumber) {
    const MAX_RETRIES = 5; // Maximum number of retries
    const RETRY_DELAY = 600; // Delay between retries in milliseconds
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
            return Number(BLOCK.timestamp);
        }
        catch (error) {
            if (error instanceof Error) {
                const err = error;
                if (err.code === 'ECONNABORTED') {
                    console.log(`getBlockTimeStamp connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else if (err.message && err.message.includes('CONNECTION ERROR')) {
                    if (retries > 3) {
                        console.log(`getBlockTimeStamp connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                }
                else {
                    console.log(`Failed to get block timestamp. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                retries++;
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    console.log('Failed to get block timestamp after several attempts. Please check your connection and the status of the Ethereum node.');
    return null;
}
export async function getBlockTimeStampsInBatches(blockNumbers) {
    const blockTimestamps = {};
    const MAX_RETRIES = 5; // Maximum number of retries
    const RETRY_DELAY = 5000; // Delay between retries in milliseconds
    for (const blockNumber of blockNumbers) {
        let retries = 0;
        while (retries < MAX_RETRIES) {
            try {
                console.log(blockNumber, blockNumbers.length);
                const block = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
                blockTimestamps[blockNumber] = Number(block.timestamp);
                break;
            }
            catch (error) {
                if (error instanceof Error) {
                    const err = error;
                    if (err.code === 'ECONNABORTED') {
                        console.log(`getBlockTimeStampsInBatches connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    else if (err.message && err.message.includes('CONNECTION ERROR')) {
                        console.log(`getBlockTimeStampsInBatches connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    else {
                        console.log(`Failed to get block timestamp. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    retries++;
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                }
            }
            if (retries === MAX_RETRIES) {
                console.log(`Failed to get timestamp for block number ${blockNumber} after several attempts. Please check your connection and the status of the Ethereum node.`);
                blockTimestamps[blockNumber] = null;
            }
        }
    }
    return blockTimestamps;
}
export async function getTxReceiptClassic(txHash) {
    try {
        let txReceipt = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
        return txReceipt;
    }
    catch (error) {
        console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
        return null;
    }
}
export async function getTxReceipt(txHash) {
    const limiter = new Bottleneck({
        maxConcurrent: 100,
        minTime: 30,
    });
    axiosRetry(axios, {
        retries: 3,
        retryDelay: (retryCount) => {
            return retryCount * 2000;
        },
        retryCondition: (error) => {
            return error.code === 'ECONNABORTED' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT';
        },
    });
    return limiter.schedule(async () => {
        try {
            const response = await axios.post(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`, {
                id: 1,
                jsonrpc: '2.0',
                method: 'eth_getTransactionReceipt',
                params: [txHash],
            }, {
                timeout: 1000,
            });
            if (response.data && response.data.result) {
                return response.data.result;
            }
            else {
                return null;
            }
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.code !== 'ECONNABORTED' && axiosError.code !== 'ERR_SOCKET_CONNECTION_TIMEOUT') {
                console.log(axiosError);
            }
            return null;
        }
    });
}
export async function getTxFromTxId(tx_id) {
    try {
        const txHash = await getTxHashByTxId(tx_id);
        if (!txHash)
            return null;
        return getTxFromTxHash(txHash);
    }
    catch (err) {
        return null;
    }
}
export async function getTxFromTxHash(txHash) {
    const MAX_RETRIES = 5; // Maximum number of retries
    const RETRY_DELAY = 5000; // Delay between retries in milliseconds
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
            return TX;
        }
        catch (error) {
            if (error instanceof Error) {
                const err = error;
                if (err.code === 'ECONNABORTED') {
                    console.log(`getTxFromTxId connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else if (err.message && err.message.includes('CONNECTION ERROR')) {
                    if (retries > 3) {
                        console.log(`getTxFromTxId connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                }
                else {
                    console.log(`Failed to get transaction by ID. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                retries++;
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    console.log(`Failed to get transaction by txHash ${txHash} after several attempts. Please check your connection and the status of the Ethereum node.`);
    return null;
}
export async function getTxWithLimiter(txHash) {
    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 300,
    });
    axiosRetry(axios, {
        retries: 3,
        retryDelay: (retryCount) => {
            return retryCount * 2000;
        },
        retryCondition: (error) => {
            return error.code === 'ECONNABORTED' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT';
        },
    });
    return limiter.schedule(async () => {
        let retries = 0;
        const MAX_RETRIES = 1;
        const RETRY_DELAY = 5000;
        while (retries < MAX_RETRIES) {
            try {
                const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
                return TX;
            }
            catch (error) {
                if (error instanceof Error) {
                    const err = error;
                    if (err.code === 'ECONNABORTED') {
                        console.log(`getTxWithLimiter connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    else if (err.message && err.message.includes('CONNECTION ERROR')) {
                        console.log(`getTxWithLimiter connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    else {
                        console.log(`Failed to get transaction by hash. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    }
                    retries++;
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        console.log(`Failed to get transaction by hash ${txHash} after several attempts. Please check your connection and the status of the Ethereum node.`);
        return null;
    });
}
export async function retryGetTransactionTraceViaWeb3Provider(txHash, maxRetries = 5) {
    try {
        let delay = 2000; // Starting delay of 2 seconds
        for (let i = 0; i < maxRetries; i++) {
            const transactionTrace = await getTransactionTraceViaWeb3Provider(txHash);
            if (transactionTrace) {
                return transactionTrace;
            }
            // Wait for delay before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Double the delay for the next retry
        }
        // If we've retried the specified number of times and still have no trace, return null.
        return null;
    }
    catch (err) {
        console.log('err in retrygetTransactionTraceViaWeb3Provider for txHash', txHash, 'err:', err);
        return null;
    }
}
export async function getTransactionTraceViaWeb3Provider(txHash, attempt = 0) {
    const url = `${process.env.WEB3_HTTP_MAINNET_PROVIDER_URL_ALCHEMY1}`;
    const maxAttempts = 3;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                method: 'trace_transaction',
                params: [txHash],
                id: 1,
                jsonrpc: '2.0',
            }),
        });
        if (response.status !== 200) {
            return null; // request failed
        }
        const data = (await response.json());
        return data.result;
    }
    catch (error) {
        const err = error;
        if (err.code === 'ECONNRESET' && attempt < maxAttempts) {
            console.log(`Retry attempt ${attempt + 1} for ${txHash}`);
            // Wait for a second before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return getTransactionTraceViaWeb3Provider(txHash, attempt + 1);
        }
        else {
            throw error;
        }
    }
}
// Get the Ether transfer value of the last transaction in a block.
export async function getLastTxValue(blockNumber) {
    try {
        const transactions = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
        if (transactions && transactions.transactions.length > 0) {
            const lastTxHash = transactions.transactions[transactions.transactions.length - 1];
            const txDetails = await WEB3_HTTP_PROVIDER.eth.getTransaction(lastTxHash);
            return parseInt(txDetails.value) / 1e18;
        }
        return 0;
    }
    catch (err) {
        console.log('err in getLastTxValue', err);
        return null;
    }
}
export async function getBlockBuilderFromBlockNumber(blockNumber) {
    try {
        const transactions = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
        if (transactions && transactions.transactions.length > 0) {
            const lastTxHash = transactions.transactions[transactions.transactions.length - 1];
            const txDetails = await WEB3_HTTP_PROVIDER.eth.getTransaction(lastTxHash);
            return txDetails.from;
        }
        return null;
    }
    catch (err) {
        console.log('err in getLastTxValue', err);
        return null;
    }
}
// Function to fetch the transaction hash at a given position for a block number
export async function getTxHashAtBlockPosition(blockNumber, position) {
    try {
        const block = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
        if (block && block.transactions.length > position) {
            return block.transactions[position];
        }
        return null;
    }
    catch (err) {
        console.error('Error in getTxHashAtPosition:', err);
        return null;
    }
}
export async function getNonceWithLimiter(address) {
    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 300,
    });
    axiosRetry(axios, {
        retries: 3,
        retryDelay: (retryCount) => {
            return retryCount * 2000;
        },
        retryCondition: (error) => {
            return error.code === 'ECONNABORTED' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT';
        },
    });
    return limiter.schedule(async () => {
        let retries = 0;
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 5000;
        while (retries < MAX_RETRIES) {
            try {
                const nonce = await WEB3_HTTP_PROVIDER.eth.getTransactionCount(address);
                return nonce;
            }
            catch (error) {
                if (error instanceof Error) {
                    const err = error;
                    console.log(`Failed to get nonce for address ${address}. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                    retries++;
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        console.log(`Failed to get nonce for address ${address} after several attempts. Please check your connection and the status of the Ethereum node.`);
        return null;
    });
}
//# sourceMappingURL=generic.js.map