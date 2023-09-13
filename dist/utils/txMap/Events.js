import { updateAbiFromContractAddress } from "../helperFunctions/Abi.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { getShortenReceiptByTxHash } from "../postgresTables/readFunctions/Receipts.js";
import { ethers } from "ethers";
export async function parseEventsFromReceiptForEntireTx(txHash) {
    const receipt = await getShortenReceiptByTxHash(txHash);
    const provider = await getWeb3HttpProvider();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);
    const parsedEventsPromises = receipt.logs.map(async (log) => {
        const contractAddress = log.address;
        const contractAbi = await updateAbiFromContractAddress(contractAddress, JsonRpcProvider);
        if (!contractAbi) {
            console.error(`No ABI found for contract address: ${contractAddress}`);
            return null;
        }
        try {
            const eventAbi = contractAbi.find((abiItem) => abiItem.type === "event" && log.topics[0] === provider.eth.abi.encodeEventSignature(abiItem));
            if (!eventAbi) {
                console.log("No matching eventABI found for topic:", log.topics[0]);
                return null;
            }
            const decodedLog = provider.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));
            for (const key in decodedLog) {
                if (!isNaN(Number(key)) || key === "__length__") {
                    delete decodedLog[key];
                }
            }
            const parsedEvent = Object.assign(Object.assign({}, decodedLog), { contractAddress, eventName: eventAbi.name });
            return parsedEvent;
        }
        catch (err) {
            console.error(`Error in parseEventsForEntireTx ${err}`);
            console.log("Failed log data:", log);
        }
    });
    let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
    resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== "string");
    return resolvedParsedEvents;
}
//# sourceMappingURL=Events.js.map