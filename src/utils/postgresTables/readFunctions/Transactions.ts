import { Op, Sequelize } from "sequelize";
import { Transactions, TransactionData, TransactionType } from "../../../models/Transactions.js";

export async function findTransactionsByPoolIdAndHash(pool_id: number, tx_hash: string): Promise<TransactionData[]> {
  const transactions = await Transactions.findAll({
    where: {
      pool_id,
      tx_hash,
    },
  });

  return transactions.map((transaction) => transaction.dataValues);
}

export async function getActivePools(): Promise<number[]> {
  const activeTransactions = await Transactions.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("pool_id")), "pool_id"]],
  });

  const activePoolIds = activeTransactions.map((transaction) => transaction.pool_id);

  return activePoolIds;
}

export async function getTransactionUnixtimes(txIds: number[]): Promise<{ tx_id: number; block_unixtime: number }[]> {
  // Find the transactions with the given ids
  const transactions = await Transactions.findAll({
    where: {
      tx_id: txIds,
    },
    attributes: ["tx_id", "block_unixtime"], // Select only 'tx_id' and 'block_unixtime'
  });

  // Map the transactions to the desired format
  const result = transactions.map((transaction) => ({
    tx_id: transaction.tx_id,
    block_unixtime: transaction.block_unixtime,
  }));

  return result;
}

export async function fetchTransactionsBatch(offset: number, BATCH_SIZE: number): Promise<TransactionData[]> {
  const transactions = await Transactions.findAll({
    attributes: ["tx_id", "pool_id", "event_id", "tx_hash", "block_number", "block_unixtime", "transaction_type", "trader", "tx_position"], // the attributes to select
    limit: BATCH_SIZE,
    offset: offset,
    raw: true, // this makes Sequelize return the raw data
    order: [
      ["block_number", "ASC"],
      ["pool_id", "ASC"],
    ], // order by block_number and pool_id to ensure consistency between batches
  });

  return transactions;
}

export async function fetchTransactionsForBlock(blockNumber: number): Promise<TransactionData[]> {
  const transactions = await Transactions.findAll({
    attributes: ["tx_id", "pool_id", "event_id", "tx_hash", "block_number", "block_unixtime", "transaction_type", "trader", "tx_position"], // the attributes to select
    where: {
      block_number: blockNumber,
    },
    raw: true, // this makes Sequelize return the raw data
    order: [
      ["block_number", "ASC"],
      ["pool_id", "ASC"],
    ], // order by block_number and pool_id
  });

  return transactions;
}

export async function getTotalTransactionsCount(): Promise<number> {
  return await Transactions.count();
}

export async function getTxHashByTxId(tx_id: number): Promise<string | null> {
  try {
    const transaction = await Transactions.findOne({
      where: {
        tx_id: tx_id,
      },
    });

    if (transaction) {
      return transaction.tx_hash;
    } else {
      console.log(`Transaction with tx_id ${tx_id} not found.`);
      return null;
    }
  } catch (error) {
    console.error(`Error while fetching transaction with tx_id ${tx_id}: ${error}`);
    return null;
  }
}

export async function getTxIdByTxHash(tx_hash: string): Promise<number | null> {
  try {
    const transaction = await Transactions.findOne({
      where: {
        tx_hash: tx_hash,
      },
    });

    if (transaction) {
      return transaction.tx_id;
    } else {
      console.log(`Transaction with tx_hash ${tx_hash} not found.`);
      return null;
    }
  } catch (error) {
    console.error(`Error while fetching transaction with tx_hash ${tx_hash}: ${error}`);
    return null;
  }
}

export async function getAllUniqueTransactionHashes(): Promise<string[]> {
  const transactions = await Transactions.findAll({
    attributes: ["tx_hash"],
    group: ["tx_hash"],
  });

  return transactions.map((transaction) => transaction.tx_hash);
}

export async function getTransactionTypeByEventId(event_id: number): Promise<TransactionType | null> {
  const transaction = await Transactions.findOne({
    where: {
      event_id,
    },
  });

  return transaction ? transaction.transaction_type : null;
}

export async function getTxIdByEventId(event_id: number): Promise<number | null> {
  try {
    const transaction = await Transactions.findOne({
      where: { event_id },
    });

    if (transaction) {
      return transaction.tx_id;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching transaction by event ID:", error);
    return null;
  }
}

export async function getAllTxIdsByTxHash(txHash: string): Promise<number[]> {
  try {
    const transactions = await Transactions.findAll({
      where: {
        tx_hash: {
          [Op.iLike]: txHash,
        },
      },
      attributes: ["tx_id"],
    });

    const txIds = transactions.map((transaction) => transaction.tx_id);
    return txIds;
  } catch (error) {
    console.error("Error fetching transaction IDs by transaction hash:", error);
    return [];
  }
}

export async function getEventIdByTxId(txId: number): Promise<number | null> {
  try {
    const transaction = await Transactions.findByPk(txId, {
      attributes: ["event_id"],
    });
    return transaction && transaction.event_id !== undefined ? transaction.event_id : null;
  } catch (error) {
    console.error("Error fetching event ID by transaction ID:", error);
    return null;
  }
}

export async function getPoolIdByTxId(txId: number): Promise<number | null> {
  try {
    const transaction = await Transactions.findByPk(txId, {
      attributes: ["pool_id"],
    });

    return transaction?.pool_id ?? null;
  } catch (error) {
    console.error("Error fetching pool ID by transaction ID:", error);
    return null;
  }
}
