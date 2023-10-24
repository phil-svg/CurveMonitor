import { updateAbiIWithProxyCheck } from "../helperFunctions/ProxyCheck.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { getImplementationAddressFromTable } from "../postgresTables/readFunctions/ProxyCheck.js";
import { getShortenReceiptByTxHash } from "../postgresTables/readFunctions/Receipts.js";
import { ethers } from "ethers";
export async function parseEventsFromReceiptForEntireTx(txHash) {
    const receipt = await getShortenReceiptByTxHash(txHash);
    if (!receipt) {
        console.log(`No receipt for ${txHash}`);
        return null;
    }
    const web3HttpProvider = await getWeb3HttpProvider();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);
    // This set will store topics we've already processed
    const processedTopics = new Set();
    const parsedEventsPromises = receipt.logs.map(async (log) => {
        let contractAddress = log.address;
        // If this topic has already been processed, skip processing it again
        if (processedTopics.has(log.topics[0])) {
            return null;
        }
        // Add the topic to the set of processed topics
        processedTopics.add(log.topics[0]);
        // checking if the contract is a proxy
        const implementationAddress = await getImplementationAddressFromTable(contractAddress);
        if (implementationAddress) {
            contractAddress = implementationAddress; // using implementation address if it's a proxy
        }
        const contractAbi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider, web3HttpProvider);
        if (!contractAbi) {
            // console.error(`No ABI found for contract address: ${contractAddress}`);
            return null;
        }
        try {
            const eventAbi = contractAbi.find((abiItem) => abiItem.type === "event" && log.topics[0] === web3HttpProvider.eth.abi.encodeEventSignature(abiItem));
            if (!eventAbi) {
                // console.log("No matching eventABI found for topic:", log.topics[0], "contract:", contractAddress);
                return null;
            }
            const decodedLog = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));
            for (const key in decodedLog) {
                if (!isNaN(Number(key)) || key === "__length__") {
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
    resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== "string");
    return resolvedParsedEvents;
}
//# sourceMappingURL=Events.js.map