import { ParsedEvent } from '../Interfaces.js';
import { updateAbiIWithProxyCheck } from '../helperFunctions/ProxyCheck.js';
import { getImplementationAddressFromTable } from '../postgresTables/readFunctions/ProxyCheck.js';
import { getShortenReceiptByTxHash } from '../postgresTables/readFunctions/Receipts.js';
import { ethers } from 'ethers';
import { WEB3_HTTP_PROVIDER, getTxReceiptClassic } from '../web3Calls/generic.js';
import { getAbiFromDbClean } from '../postgresTables/readFunctions/Abi.js';

export async function parseEventsFromReceiptForEntireTx(
  txHash: string
): Promise<(ParsedEvent | null | undefined)[] | null> {
  const receipt = await getShortenReceiptByTxHash(txHash);

  if (!receipt) {
    // console.log(`No receipt for ${txHash} in function parseEventsFromReceiptForEntireTx`);
    return null;
  }

  // This set will store topics we've already processed
  const processedTopics = new Set<string>();

  const parsedEventsPromises = receipt!.logs.map(async (log) => {
    let contractAddress = log.address;

    // Add the topic to the set of processed topics
    processedTopics.add(log.topics[0]);

    const contractAbi = await getAbiFromDbClean(contractAddress);

    if (!contractAbi) return null;

    try {
      const eventAbi = contractAbi.find(
        (abiItem: any) =>
          abiItem.type === 'event' && log.topics[0] === WEB3_HTTP_PROVIDER.eth.abi.encodeEventSignature(abiItem)
      );

      if (!eventAbi) return null;

      const decodedLog = WEB3_HTTP_PROVIDER.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));

      for (const key in decodedLog) {
        if (!isNaN(Number(key)) || key === '__length__') {
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
      // console.error(`Error in parseEventsForEntireTx ${err}`);
      // console.log("Failed log data:", log);
      return null;
    }
  });

  let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
  resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== 'string');

  return resolvedParsedEvents;
}

export async function parseEventsFromReceiptForEntireTxWithoutDbUsage(
  txHash: string
): Promise<(ParsedEvent | null | undefined)[] | null> {
  let receipt = await getTxReceiptClassic(txHash);

  if (!receipt) {
    console.log(`No receipt for ${txHash} in function parseEventsFromReceiptForEntireTxWithoutDbUsage`);
    return null;
  }

  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP_MAINNET);

  const processedTopics = new Set<string>();

  const parsedEventsPromises = receipt!.logs.map(async (log) => {
    let contractAddress = log.address;
    processedTopics.add(log.topics[0]);
    const implementationAddress = await getImplementationAddressFromTable(contractAddress);
    if (implementationAddress) {
      contractAddress = implementationAddress; // using implementation address if it's a proxy
    }

    const contractAbi = await updateAbiIWithProxyCheck(contractAddress, JsonRpcProvider);

    if (!contractAbi) {
      return null;
    }

    try {
      const eventAbi = contractAbi.find(
        (abiItem: any) =>
          abiItem.type === 'event' && log.topics[0] === WEB3_HTTP_PROVIDER.eth.abi.encodeEventSignature(abiItem)
      );

      if (!eventAbi) {
        return null;
      }

      const decodedLog = WEB3_HTTP_PROVIDER.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1));

      for (const key in decodedLog) {
        if (!isNaN(Number(key)) || key === '__length__') {
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
      console.error(`Error in parseEventsFromReceiptForEntireTxWithoutDbUsage ${err}`);
      return null;
    }
  });

  let resolvedParsedEvents = await Promise.all(parsedEventsPromises);
  resolvedParsedEvents = resolvedParsedEvents.filter((item) => item !== null && typeof item !== 'string');

  return resolvedParsedEvents;
}
