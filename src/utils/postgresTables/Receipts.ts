import { Sequelize } from "sequelize";
import { Receipts } from "../../models/Receipts.js";
import { Transactions } from "../../models/Transactions.js";
import { getTxReceipt } from "../web3Calls/generic.js";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";

const web3 = await getWeb3HttpProvider();

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
    blockNumber: web3.utils.toDecimal(hexTxReceipt.blockNumber),
    logs: hexTxReceipt.logs.map((log: HexLog) => {
      return {
        transactionHash: log.transactionHash,
        address: log.address,
        blockHash: log.blockHash,
        blockNumber: web3.utils.toDecimal(log.blockNumber),
        data: log.data,
        logIndex: web3.utils.toDecimal(log.logIndex),
        removed: log.removed,
        topics: log.topics,
        transactionIndex: web3.utils.toDecimal(log.transactionIndex),
      } as Log;
    }),
    contractAddress: hexTxReceipt.contractAddress,
    effectiveGasPrice: web3.utils.toDecimal(hexTxReceipt.effectiveGasPrice),
    cumulativeGasUsed: web3.utils.toDecimal(hexTxReceipt.cumulativeGasUsed),
    from: hexTxReceipt.from,
    gasUsed: web3.utils.toDecimal(hexTxReceipt.gasUsed),
    logsBloom: hexTxReceipt.logsBloom,
    status: web3.utils.toDecimal(hexTxReceipt.status),
    to: hexTxReceipt.to,
    transactionIndex: web3.utils.toDecimal(hexTxReceipt.transactionIndex),
    type: web3.utils.toDecimal(hexTxReceipt.type),
  };
}

async function fetchAndSaveReceipt(txHash: string, txId: number) {
  let hexTxReceipt: HexTxReceipt = await getTxReceipt(txHash);

  if (!hexTxReceipt) {
    console.warn(`No transaction receipt found for hash: ${txHash}`);
    return;
  }

  const txReceipt: TxReceipt = convertHexReceiptToDecimal(hexTxReceipt);

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
        type: txReceipt.type,
      });
    }
  }
}

export async function updateReceipts() {
  console.log(`updating Receipts started...`);
  try {
    // Fetch all unique transaction hashes from Transactions.
    const transactions = await Transactions.findAll({
      attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("tx_hash")), "tx_hash"], "tx_id"],
    });

    // Fetch all unique transaction hashes from Receipts.
    const existingReceipts = await Receipts.findAll({
      attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("transactionHash")), "transactionHash"]],
    });

    // Create sets of hashes for easier comparison.
    const transactionsSet = new Set(transactions.map((tx) => tx.tx_hash));
    const existingReceiptsSet = new Set(existingReceipts.map((rcpt) => rcpt.transactionHash));

    // Find the set of transaction hashes for which we need to fetch receipts.
    const toBeFetchedSet = [...transactionsSet].filter((txHash) => !existingReceiptsSet.has(txHash));

    const totalToBeFetched = toBeFetchedSet.length;
    console.log("totalToBeFetched", totalToBeFetched);

    let count = 0;

    // For each transaction hash in toBeFetchedSet.
    for (const txHash of toBeFetchedSet) {
      // Find the corresponding transaction in the transactions list.
      const tx = transactions.find((transaction) => transaction.tx_hash === txHash);

      if (!tx) {
        console.log(`No tx for ${txHash} at updateReceipts.`);
        continue;
      }

      try {
        await fetchAndSaveReceipt(tx.tx_hash, tx.tx_id);
        count++;

        // Log progress for every 100th fetched receipt.
        if (count > 0 && count % 100 === 0) {
          const percentage = ((count / totalToBeFetched) * 100).toFixed(2);
          console.log(`Fetched receipts: ${count}/${totalToBeFetched} (${percentage}%)`);
        }
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