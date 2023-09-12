import { updateAbiFromContractAddress } from "../helperFunctions/Abi.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { getShortenReceiptByTxHash } from "../postgresTables/readFunctions/Receipts.js";
export async function parseEventsFromReceiptForEntireTx(txHash) {
    const receipt = await getShortenReceiptByTxHash(txHash);
    const provider = await getWeb3HttpProvider();
    const parsedEventsPromises = receipt.logs.map(async (log) => {
        const contractAddress = log.address;
        const contractAbi = await updateAbiFromContractAddress(contractAddress);
        if (!contractAbi) {
            console.error(`No ABI found for contract address: ${contractAddress}`);
            return null;
        }
        try {
            const eventAbi = contractAbi.find((abiItem) => abiItem.type === "event" && log.topics[0] === provider.eth.abi.encodeEventSignature(abiItem));
            if (!eventAbi) {
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
            console.log(`Err in parseEventsForEntireTx ${err}`);
        }
    });
    let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
    resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== "string");
    return resolvedParsedEvents;
}
//# sourceMappingURL=Events.js.map