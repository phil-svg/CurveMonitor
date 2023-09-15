import { ParsedEvent } from "../Interfaces.js";
import { updateAbiFromContractAddress } from "../helperFunctions/Abi.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { isContractVerified } from "../postgresTables/readFunctions/Abi.js";
import { getProxyImplementationAddress } from "../postgresTables/readFunctions/ProxyCheck.js";
import { getShortenReceiptByTxHash } from "../postgresTables/readFunctions/Receipts.js";
import { ethers } from "ethers";

export async function parseEventsFromReceiptForEntireTx(txHash: string): Promise<(ParsedEvent | null | undefined)[]> {
  const receipt = await getShortenReceiptByTxHash(txHash);

  const web3HttpProvider = await getWeb3HttpProvider();
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);

  const parsedEventsPromises = receipt!.logs.map(async (log) => {
    let contractAddress = log.address;

    // checking if the contract is a proxy
    const implementationAddress = await getProxyImplementationAddress(contractAddress);
    if (implementationAddress) {
      contractAddress = implementationAddress; // using implementation address if it's a proxy
    }

    const contractAbi = await updateAbiFromContractAddress(contractAddress, JsonRpcProvider, web3HttpProvider);

    if (!contractAbi) {
      console.error(`No ABI found for contract address: ${contractAddress}`);
      return null;
    }

    if (!(await isContractVerified(contractAddress))) {
      console.log(`Contract at address: ${contractAddress} is not verified.`);
      return null;
    }

    try {
      const eventAbi = contractAbi.find((abiItem: any) => abiItem.type === "event" && log.topics[0] === web3HttpProvider.eth.abi.encodeEventSignature(abiItem));

      if (!eventAbi) {
        console.log("No matching eventABI found for topic:", log.topics[0], "contract:", contractAddress);
        return null;
      }

      const decodedLog = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));

      for (const key in decodedLog) {
        if (!isNaN(Number(key)) || key === "__length__") {
          delete decodedLog[key];
        }
      }

      const parsedEvent: ParsedEvent = {
        ...decodedLog,
        contractAddress: log.address,
        eventName: eventAbi.name,
      };
      return parsedEvent;
    } catch (err) {
      console.error(`Error in parseEventsForEntireTx ${err}`);
      console.log("Failed log data:", log);
    }
  });

  let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
  resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== "string");

  return resolvedParsedEvents;
}
