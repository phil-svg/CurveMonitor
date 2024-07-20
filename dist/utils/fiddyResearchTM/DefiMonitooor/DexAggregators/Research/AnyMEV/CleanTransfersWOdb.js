import Web3 from 'web3';
import { NULL_ADDRESS } from '../../../../../helperFunctions/Constants.js';
import axios, { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { addPositionField, filterNullSymbols, findTokenDetails, removeDuplicatesAndUpdatePositions, updateTransferList, } from '../../../../../txMap/TransferOverview.js';
import { ABI_DECIMALS, ABI_SYMBOL, ADDRESS_ETH, ADDRESS_MKR, ADDRESS_REUSD, } from '../../../../../postgresTables/Coins.js';
import { filterForCorrectTransfers } from '../../../../../postgresTables/mevDetection/atomic/atomicArb.js';
export async function getTransactionTraceViaWeb3ProviderForChain(txHash, chain, attempt = 0) {
    let url;
    if (chain === 'ethereum') {
        url = `${process.env.WEB3_HTTP_ETHEREUM_DWELLIR}`;
    }
    else if (chain === 'base') {
        url = `${process.env.WEB3_HTTP_BASE_DWELLIR}`;
    }
    else {
        return null;
    }
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
            return getTransactionTraceViaWeb3ProviderForChain(txHash, chain, attempt + 1);
        }
        else {
            throw error;
        }
    }
}
export async function getTxReceiptFromProviderForChain(txHash, chain) {
    try {
        let providerUrl;
        if (chain === 'ethereum') {
            providerUrl = `${process.env.WEB3_HTTP_ETHEREUM_DWELLIR}`;
        }
        else if (chain === 'base') {
            providerUrl = `${process.env.WEB3_HTTP_BASE_DWELLIR}`;
        }
        else {
            return null;
        }
        const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(providerUrl));
        let txReceipt = await web3HttpProvider.eth.getTransactionReceipt(txHash);
        return txReceipt;
    }
    catch (error) {
        console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
        return null;
    }
}
export async function fetchAbiFromEtherscanForChain(address, chain) {
    if (address === NULL_ADDRESS)
        return null;
    let chainHolder;
    let apiKey;
    if (chain === 'ethereum') {
        chainHolder = 'etherscan.io';
        apiKey = process.env.ETHERSCAN_KEY;
    }
    else if (chain === 'base') {
        chainHolder = 'basescan.org';
        apiKey = process.env.BASESCAN_KEY;
    }
    const URL = `https://api.${chainHolder}/api?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
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
    const etherscanLimiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 200, // Minimum time between requests
    });
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
export async function parseEventsFromReceiptForEntireTxWOdb(txHash, chain, web3HttpProvider) {
    const receipt = await getTxReceiptFromProviderForChain(txHash, chain);
    if (!receipt) {
        // console.log(`No receipt for ${txHash} in function parseEventsFromReceiptForEntireTx`);
        return null;
    }
    // This set will store topics we've already processed
    const processedTopics = new Set();
    const parsedEventsPromises = receipt.logs.map(async (log) => {
        let contractAddress = log.address;
        // Add the topic to the set of processed topics
        processedTopics.add(log.topics[0]);
        // let contractAbi = await fetchAbiFromEtherscanForChain(contractAddress, chain);
        const hardcodedTransferEvent = {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: 'address', name: 'src', type: 'address' },
                { indexed: true, internalType: 'address', name: 'dst', type: 'address' },
                { indexed: false, internalType: 'uint256', name: 'wad', type: 'uint256' },
            ],
            name: 'Transfer',
            type: 'event',
        };
        // if (!contractAbi) {
        //   contractAbi = [hardcodedTransferEvent];
        // }
        let contractAbi = [hardcodedTransferEvent];
        // Check if the 'Transfer' event is already part of the ABI
        const hasTransferEvent = contractAbi.some((item) => item.type === 'event' && item.name === 'Transfer');
        // If the 'Transfer' event is not found, add the hardcoded event
        if (!hasTransferEvent) {
            contractAbi.push(hardcodedTransferEvent);
        }
        try {
            const eventAbi = contractAbi.find((abiItem) => abiItem.type === 'event' && log.topics[0] === web3HttpProvider.eth.abi.encodeEventSignature(abiItem));
            if (!eventAbi)
                return null;
            const decodedLog = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));
            for (const key in decodedLog) {
                if (!isNaN(Number(key)) || key === '__length__') {
                    delete decodedLog[key];
                }
            }
            const parsedEvent = Object.assign(Object.assign({}, decodedLog), { contractAddress: log.address, eventName: eventAbi.name });
            return parsedEvent;
        }
        catch (err) {
            // console.error(`Error in parseEventsForEntireTx ${err}`);
            // console.log("Failed log data:", log);
            return null;
        }
    });
    let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
    resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== 'string');
    return resolvedParsedEvents;
}
/**
 * Merges token transfers from transaction traces with parsed events from a receipt,
 * placing new entries in the first array based on their position in the second array.
 *
 * @param parsedEventsFromReceipt - Array of parsed events (possibly including null or undefined elements).
 * @returns Array of TokenTransfer objects after merging and filtering.
 */
export function filterTransfers(parsedEventsFromReceipt) {
    let tokenTransfers = [];
    // Filter out only transfer events from the parsed events
    const transferEventsFromReceipt = parsedEventsFromReceipt.filter((event) => (event === null || event === void 0 ? void 0 : event.eventName) === 'Transfer');
    // Iterate over each transfer event from the receipt
    transferEventsFromReceipt.forEach((event, index) => {
        if (event) {
            // Extract keys from the event object
            const keys = Object.keys(event);
            const newTransfer = {
                from: event[keys[0]],
                to: event[keys[1]],
                token: event[keys[3]],
                value: event[keys[2]],
            };
            // Insert at the same index as in parsedEventsFromReceipt, or push at the end if index is out of bounds
            if (index < tokenTransfers.length) {
                tokenTransfers.splice(index, 0, newTransfer);
            }
            else {
                tokenTransfers.push(newTransfer);
            }
        }
    });
    // Return the merged and reordered array of transfers
    return tokenTransfers;
}
export async function getTokenSymbolWOdbForChain(coinAddress, web3HttpProvider) {
    if (coinAddress === ADDRESS_ETH)
        return 'ETH';
    if (coinAddress === ADDRESS_MKR)
        return 'MKR';
    if (coinAddress === ADDRESS_REUSD)
        return 'REUSD';
    const CONTRACT = new web3HttpProvider.eth.Contract(ABI_SYMBOL, coinAddress);
    return CONTRACT.methods.symbol().call();
}
export async function getTokenDecimalWOdbForChain(coinAddress, web3HttpProvider) {
    if (coinAddress === ADDRESS_ETH)
        return 18;
    const CONTRACT = new web3HttpProvider.eth.Contract(ABI_DECIMALS, coinAddress);
    return CONTRACT.methods.decimals().call();
}
export async function getTokenDetailsForTokenArrayWOdb(uniqueTokenArray, web3HttpProvider, getAllToken) {
    const hardcodedTokens = {
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
        '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
    };
    const tokenDetailsArray = [];
    for (const coinAddress of uniqueTokenArray) {
        try {
            const normalizedAddress = coinAddress.toLowerCase(); // Normalize the address for case-insensitive comparison
            let symbol, decimals;
            // Check if the address has hardcoded values, use them if available
            if (hardcodedTokens[normalizedAddress]) {
                symbol = hardcodedTokens[normalizedAddress].symbol;
                decimals = hardcodedTokens[normalizedAddress].decimals;
            }
            else {
                if (getAllToken) {
                    // Otherwise, fetch dynamically
                    const symbolPromise = getTokenSymbolWOdbForChain(coinAddress, web3HttpProvider);
                    const decimalsPromise = getTokenDecimalWOdbForChain(coinAddress, web3HttpProvider);
                    [symbol, decimals] = await Promise.all([symbolPromise, decimalsPromise]);
                }
                else {
                    continue;
                }
            }
            // Push the token details to the array
            tokenDetailsArray.push({
                address: coinAddress,
                symbol: symbol,
                decimals: decimals,
            });
        }
        catch (error) {
            // console.error(`Failed to fetch details for token address ${coinAddress}:`, error);
            tokenDetailsArray.push({
                address: coinAddress,
                symbol: null,
                decimals: null,
            });
        }
    }
    return tokenDetailsArray;
}
export async function makeTransfersReadableWOdb(tokenTransfers, web3HttpProvider, getAllToken) {
    let readableTransfers = [];
    const uniqueTokens = new Set(tokenTransfers.map((transfer) => transfer.token));
    const uniqueTokenArray = Array.from(uniqueTokens);
    const tokenDetailsArray = await getTokenDetailsForTokenArrayWOdb(uniqueTokenArray, web3HttpProvider, getAllToken);
    for (let transfer of tokenTransfers) {
        const details = findTokenDetails(transfer.token, tokenDetailsArray);
        const tokenSymbol = details === null || details === void 0 ? void 0 : details.symbol;
        const tokenDecimals = details === null || details === void 0 ? void 0 : details.decimals;
        if (!tokenDecimals || tokenDecimals === 0 || tokenDecimals === 420)
            continue;
        if (!tokenSymbol)
            continue;
        let parsedAmount = 0;
        if (tokenDecimals !== null) {
            const rawAmountBigInt = BigInt(transfer.value);
            const coinAmount = Number(rawAmountBigInt) / Math.pow(10, tokenDecimals);
            parsedAmount = Number(coinAmount.toFixed(15));
        }
        readableTransfers.push({
            from: transfer.from,
            to: transfer.to,
            tokenAddress: transfer.token,
            tokenSymbol,
            parsedAmount,
        });
    }
    readableTransfers = filterNullSymbols(readableTransfers);
    const res = addPositionField(readableTransfers);
    return res;
}
export async function getCleanedTransfersWOdbWOtraceForChain(txHash, chain, web3HttpProvider, to, getAllToken) {
    const parsedEventsFromReceipt = await parseEventsFromReceiptForEntireTxWOdb(txHash, chain, web3HttpProvider);
    if (!parsedEventsFromReceipt) {
        console.log('Failed to get Receipt');
        return null;
    }
    // console.log('parsedEventsFromReceipt', parsedEventsFromReceipt);
    const transfers = filterTransfers(parsedEventsFromReceipt);
    const readableTransfers = await makeTransfersReadableWOdb(transfers, web3HttpProvider, getAllToken);
    let updatedReadableTransfers = [];
    updatedReadableTransfers = updateTransferList(readableTransfers, to);
    const correctTrasfers = filterForCorrectTransfers(updatedReadableTransfers);
    const cleanedTransfers = removeDuplicatesAndUpdatePositions(correctTrasfers);
    return cleanedTransfers;
}
//# sourceMappingURL=CleanTransfersWOdb.js.map