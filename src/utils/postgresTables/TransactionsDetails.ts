import { Op, Optional } from "sequelize";
import _ from "lodash";
import { Transactions } from "../../models/Transactions.js";
import { getTxWithLimiter } from "../web3Calls/generic.js";
import { getTxHashByTxId } from "./readFunctions/Transactions.js";
import { TransactionDetails } from "../../models/TransactionDetails.js";

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

  const tx = await getTxWithLimiter(txHash);

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

export async function updateTransactionsDetails() {
  try {
    const existingCalls = await TransactionDetails.findAll({
      attributes: ["txId"],
      raw: true,
    });

    const existingTxIds = existingCalls.map((call) => call.txId);

    const unsolvedTransactions = await Transactions.findAll({
      where: {
        tx_id: { [Op.notIn]: existingTxIds },
      },
      attributes: ["tx_id"],
      raw: true,
    });

    const chunkSize = 5;
    const transactionChunks = _.chunk(unsolvedTransactions, chunkSize);

    for (const [i, transactionChunk] of transactionChunks.entries()) {
      const results = await Promise.all(transactionChunk.map((transaction) => solveSingleTdId(transaction.tx_id)));

      const validResults = results.filter((result): result is NonNullable<typeof result> => result !== null);
      await TransactionDetails.bulkCreate(validResults);

      console.log(`Completed ${i + 1} out of ${transactionChunks.length} chunks for TransactionCalls(${(((i + 1) / transactionChunks.length) * 100).toFixed(2)}%)`);
    }
  } catch (error) {
    console.error(`Error in updateTransactionsCalls: ${error}`);
  }
}
