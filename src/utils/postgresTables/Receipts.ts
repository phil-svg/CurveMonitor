import { Receipts } from "../../models/Receipts.js";
import { Transactions } from "../../models/Transactions.js";
import { WEB3_HTTP_PROVIDER, getTxReceiptClassic } from "../web3Calls/generic.js";
import { logProgress, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";

interface HexLog {
  transactionHash: string;
  address: string;
  blockHash: string;
  blockNumber: string; // hexadecimal
  data: string;
  logIndex: string; // hexadecimal
  removed: boolean;
  topics: Array<string>;
  transactionIndex: string; // hexadecimal
}

interface HexTxReceipt {
  transactionHash: string;
  blockHash: string;
  blockNumber: string; // hexadecimal
  logs: Array<HexLog>;
  contractAddress: string | null;
  effectiveGasPrice: string; // hexadecimal
  cumulativeGasUsed: string; // hexadecimal
  from: string;
  gasUsed: string; // hexadecimal
  logsBloom: string;
  status: string; // hexadecimal
  to: string;
  transactionIndex: string; // hexadecimal
  type: string; // hexadecimal
}

interface Log {
  transactionHash: string;
  address: string;
  blockHash: string;
  blockNumber: number;
  data: string;
  logIndex: number;
  removed: boolean;
  topics: Array<string>;
  transactionIndex: number;
}

interface TxReceipt {
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  logs: Array<Log>;
  contractAddress: string | null;
  effectiveGasPrice: number;
  cumulativeGasUsed: number;
  from: string;
  gasUsed: number;
  logsBloom: string;
  status: number;
  to: string;
  transactionIndex: number;
  type: number;
}

function convertHexReceiptToDecimal(hexTxReceipt: HexTxReceipt): TxReceipt {
  return {
    transactionHash: hexTxReceipt.transactionHash,
    blockHash: hexTxReceipt.blockHash,
    blockNumber: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.blockNumber),
    logs: hexTxReceipt.logs.map((log: HexLog) => {
      return {
        transactionHash: log.transactionHash,
        address: log.address,
        blockHash: log.blockHash,
        blockNumber: WEB3_HTTP_PROVIDER.utils.toDecimal(log.blockNumber),
        data: log.data,
        logIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(log.logIndex),
        removed: log.removed,
        topics: log.topics,
        transactionIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(log.transactionIndex),
      } as Log;
    }),
    contractAddress: hexTxReceipt.contractAddress,
    effectiveGasPrice: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.effectiveGasPrice),
    cumulativeGasUsed: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.cumulativeGasUsed),
    from: hexTxReceipt.from,
    gasUsed: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.gasUsed),
    logsBloom: hexTxReceipt.logsBloom,
    status: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.status),
    to: hexTxReceipt.to,
    transactionIndex: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.transactionIndex),
    type: WEB3_HTTP_PROVIDER.utils.toDecimal(hexTxReceipt.type),
  };
}

export async function fetchAndSaveReceipt(txHash: string, txId: number): Promise<any> {
  // let hexTxReceipt: HexTxReceipt = await getTxReceipt(txHash);
  // if (!hexTxReceipt) {
  //   console.warn(`No receipt found for hash: ${txHash} in fetchAndSaveReceipt`);
  //   return null;
  // }
  //
  // type: txReceipt.type,

  // const txReceipt: TxReceipt = convertHexReceiptToDecimal(hexTxReceipt);
  let txReceipt = await getTxReceiptClassic(txHash);

  if (txReceipt) {
    // Iterate over each log in txReceipt.logs.
    for (const log of txReceipt.logs) {
      // Create a new database record for each log.
      await Receipts.create({
        ...log,
        tx_id: txId,
        transactionHash: txReceipt.transactionHash,
        blockHash: txReceipt.blockHash,
        blockNumber: txReceipt.blockNumber,
        contractAddress: txReceipt.contractAddress,
        effectiveGasPrice: txReceipt.effectiveGasPrice,
        cumulativeGasUsed: txReceipt.cumulativeGasUsed,
        from: txReceipt.from,
        gasUsed: txReceipt.gasUsed,
        logsBloom: txReceipt.logsBloom,
        status: txReceipt.status,
        to: txReceipt.to,
        type: 2,
      });
    }
    return true;
  } else {
    console.log(`No receipt found for hash: ${txHash} in fetchAndSaveReceipt`);
  }
}

export async function updateReceipts() {
  try {
    // Fetch all unique transaction hashes and their IDs from Transactions.
    const transactions = await Transactions.findAll({
      attributes: ["tx_hash", "tx_id"],
      raw: true,
    });

    // Create a map of transaction hashes to their IDs.
    const transactionsMap = new Map<string, number>();
    transactions.forEach((tx) => {
      transactionsMap.set(tx.tx_hash, tx.tx_id);
    });

    // Fetch all unique transaction hashes from Receipts.
    const existingReceipts = await Receipts.findAll({
      attributes: ["transactionHash"],
      group: "transactionHash",
      raw: true,
    });

    // Create a set of existing receipt transaction hashes for comparison.
    const existingReceiptsSet = new Set(existingReceipts.map((rcpt) => rcpt.transactionHash));

    // Find the set of transaction hashes for which we need to fetch receipts.
    const toBeFetchedSet = [...transactionsMap.keys()].filter((txHash) => !existingReceiptsSet.has(txHash));

    const totalToBeFetched = toBeFetchedSet.length;
    let count = 0;
    let totalTimeTaken = 0;

    // For each transaction hash in toBeFetchedSet.
    for (const txHash of toBeFetchedSet) {
      if (txHash === "0x1cb373281a6aa3c161eb073b5f49f38f5c2a2a6e8ed9dcb637c941ede601daff") continue;
      if (txHash === "0xd67ec9e7a7c5bc4b2b7ee12ffb3a1a3c182d5d83a03df1d750663340d11af4fd") continue;

      const txId = transactionsMap.get(txHash);

      if (!txId) {
        console.log("no txId found for txHash", txHash, "in updateReceipts");
        process.exit();
      }

      try {
        const start = new Date().getTime();
        await fetchAndSaveReceipt(txHash, txId);
        count++;
        const end = new Date().getTime();
        totalTimeTaken += end - start;
        logProgress("Fetching Receipts", 100, count, totalTimeTaken, totalToBeFetched);
      } catch (err) {
        console.warn(`Failed to fetch and save receipt for hash: ${txHash}`);
        console.error(err);
      }
    }
  } catch (error) {
    console.error(error);
  }

  updateConsoleOutput("[✓] Receipts stored successfully.\n");
}
