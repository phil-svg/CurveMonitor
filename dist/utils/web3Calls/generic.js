import { getWeb3WsProvider, getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import axios from "axios";
import Bottleneck from "bottleneck";
import { ABI_TRANSFER } from "../helperFunctions/Erc20Abis.js";
import { findCoinAddressById } from "../postgresTables/readFunctions/Coins.js";
import { getTxHashByTxId } from "../postgresTables/readFunctions/Transactions.js";
const WEB3_WS_PROVIDER = getWeb3WsProvider();
const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
function isCupsErr(err) {
    return err.message.includes("compute units per second capacity");
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
                    console.log("Error in getCurrentBlockNumber", blockNumber, error.message);
                }
                else {
                    console.log("Error in getCurrentBlockNumber", blockNumber, "Unknown error");
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
                if (errorString.includes("Log response size exceeded.")) {
                    const matchResult = errorString.match(/\[.*\]/g);
                    if (matchResult) {
                        const recommendedBlockRange = matchResult[0];
                        const [start, end] = recommendedBlockRange
                            .slice(1, -1)
                            .split(", ")
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
export async function getTokenTransferEvents(coinID, blockNumber) {
    const COIN_ADDRESS = await findCoinAddressById(coinID);
    const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_TRANSFER, COIN_ADDRESS);
    return await getPastEvents(CONTRACT, "Transfer", blockNumber, blockNumber);
}
export async function web3Call(CONTRACT, method, params, blockNumber = { block: "latest" }) {
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
export async function getBlockTimeStamp(blockNumber) {
    const BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
    return Number(BLOCK.timestamp);
}
export async function getBlockTimeStampsInBatches(blockNumbers) {
    const blockTimestamps = {};
    for (const blockNumber of blockNumbers) {
        console.log(blockNumber, blockNumbers.length);
        const block = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
        blockTimestamps[blockNumber] = Number(block.timestamp);
    }
    return blockTimestamps;
}
export async function getTxReceiptClassic(txHash) {
    try {
        const TX_RECEIPT = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
        return TX_RECEIPT;
    }
    catch (error) {
        console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
        return null;
    }
}
// maxConcurrent defines the maximum number of tasks that can be running at once.
// minTime defines the minimum amount of time between starting tasks.
const limiter = new Bottleneck({
    maxConcurrent: 100,
    minTime: 25,
});
export async function getTxReceipt(txHash) {
    return limiter.schedule(async () => {
        try {
            const response = await axios.post(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`, {
                id: 1,
                jsonrpc: "2.0",
                method: "eth_getTransactionReceipt",
                params: [txHash],
            }, {
                timeout: 5000, // Set a timeout of 5000 milliseconds
            });
            if (response.data && response.data.result) {
                return response.data.result;
            }
            else {
                console.log(response);
                return null;
            }
        }
        catch (error) {
            console.log(error);
            return null;
        }
    });
}
export async function getTxFromTxId(tx_id) {
    try {
        const txHash = await getTxHashByTxId(tx_id);
        const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
        return TX;
    }
    catch (err) {
        console.log(err);
        return null;
    }
}
//# sourceMappingURL=generic.js.map