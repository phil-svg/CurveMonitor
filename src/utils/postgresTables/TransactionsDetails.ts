import { Optional } from "sequelize";
import _ from "lodash";
import { Transactions } from "../../models/Transactions.js";
import { getTxFromTxHash } from "../web3Calls/generic.js";
import { getTxHashByTxId } from "./readFunctions/Transactions.js";
import { TransactionDetails } from "../../models/TransactionDetails.js";
import { logProgress, updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";

export interface TransactionDetailsData {
  txId: number;
  blockHash: string;
  blockNumber: number;
  hash: string;
  chainId: string;
  from: string;
  gas: bigint;
  gasPrice: string;
  input: string;
  nonce: number;
  r: string;
  s: string;
  to: string;
  transactionIndex: number;
  type: number;
  v: string;
  value: string;
}

export type TransactionDetailsCreationAttributes = Optional<TransactionDetailsData, never>;

export async function solveSingleTdId(txId: number): Promise<TransactionDetailsCreationAttributes | null> {
  const txHash = await getTxHashByTxId(txId);
  if (!txHash) return null;

  // const tx = await getTxWithLimiter(txHash);
  const tx = await getTxFromTxHash(txHash);
  if (!tx) return null;

  return {
    txId: txId,
    blockHash: tx.blockHash,
    blockNumber: tx.blockNumber,
    hash: tx.hash,
    chainId: tx.chainId,
    from: tx.from,
    gas: tx.gas,
    gasPrice: tx.gasPrice,
    input: tx.input,
    nonce: tx.nonce,
    r: tx.r,
    s: tx.s,
    to: tx.to,
    transactionIndex: tx.transactionIndex,
    type: tx.type,
    v: tx.v,
    value: tx.value,
  };
}

async function getUnsolvedTransactions() {
  // Fetch all transaction IDs from TransactionDetails
  const existingCalls = await TransactionDetails.findAll({
    attributes: ["txId"],
    raw: true,
  });
  const existingTxIds = new Set(existingCalls.map((call) => call.txId));

  // Fetch all transaction IDs from Transactions
  const allTransactions = await Transactions.findAll({
    attributes: ["tx_id"],
    raw: true,
  });
  const allTxIds = allTransactions.map((transaction) => transaction.tx_id);

  // Filter out transaction IDs that exist in existingCalls
  const unsolvedTransactions = allTxIds.filter((txId) => !existingTxIds.has(txId));

  return unsolvedTransactions;
}

export async function updateTransactionsDetails() {
  const unsolvedTxIds = await getUnsolvedTransactions();

  const chunkSize = 6;
  const transactionChunks = _.chunk(unsolvedTxIds, chunkSize);

  let totalTimeTaken = 0;

  for (const [i, transactionChunk] of transactionChunks.entries()) {
    try {
      const start = new Date().getTime();

      const results = await Promise.all(transactionChunk.map((txId) => solveSingleTdId(txId)));

      const validResults = results.filter((result): result is NonNullable<typeof result> => result !== null);
      await TransactionDetails.bulkCreate(validResults);

      let counter = i + 1;
      let totalToBeProcessed = transactionChunks.length;
      const end = new Date().getTime();
      totalTimeTaken += end - start;

      logProgress("updating TransactionsDetails", 40, counter, totalTimeTaken, totalToBeProcessed);
    } catch (error) {
      console.error(`Error in chunk ${i + 1} of updateTransactionsDetails: ${error}`);
    }
  }
  updateConsoleOutput("[✓] TransactionsDetails parsed successfully.\n");
}
