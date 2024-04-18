import { Optional, QueryTypes } from 'sequelize';
import { sequelize } from '../../config/Database.js';
import _ from 'lodash';
import { getTxFromTxHash } from '../web3Calls/generic.js';
import { getTxHashByTxId } from './readFunctions/Transactions.js';
import { TransactionDetails } from '../../models/TransactionDetails.js';
import { logProgress, updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';

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

export async function getUnsolvedTransactionsForTxDetails(): Promise<number[]> {
  const query = `
        SELECT t.tx_id
        FROM transactions t
        LEFT JOIN transaction_details td ON t.tx_id = td.tx_id
        WHERE td.tx_id IS NULL
        ORDER BY t.tx_id ASC;
    `;

  const result = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
  });

  // Map the result to return an array of transaction IDs only
  return result.map((row: any) => row.tx_id);
}

export async function updateTransactionsDetails() {
  let unsolvedTxIds = await getUnsolvedTransactionsForTxDetails();

  const chunkSize = 6;
  const transactionChunks = _.chunk(unsolvedTxIds, chunkSize);
  unsolvedTxIds = [];

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

      logProgress('updating TransactionsDetails', 40, counter, totalTimeTaken, totalToBeProcessed);
    } catch (error) {
      console.error(`Error in chunk ${i + 1} of updateTransactionsDetails: ${error}`);
    }
  }

  updateConsoleOutput('[✓] TransactionsDetails parsed successfully.\n');
}
