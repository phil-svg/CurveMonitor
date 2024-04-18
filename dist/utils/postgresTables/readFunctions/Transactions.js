import { Op, Sequelize, col, fn } from 'sequelize';
import { Transactions, TransactionType } from '../../../models/Transactions.js';
import { TransactionCoins } from '../../../models/TransactionCoins.js';
export async function findTransactionsByPoolIdAndHash(pool_id, tx_hash) {
    const transactions = await Transactions.findAll({
        where: {
            pool_id,
            tx_hash,
        },
    });
    return transactions.map((transaction) => transaction.dataValues);
}
export async function getActivePools() {
    const activeTransactions = await Transactions.findAll({
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('pool_id')), 'pool_id']],
    });
    const activePoolIds = activeTransactions.map((transaction) => transaction.pool_id);
    return activePoolIds;
}
export async function getTransactionUnixtimes(txIds) {
    // Find the transactions with the given ids
    const transactions = await Transactions.findAll({
        where: {
            tx_id: txIds,
        },
        attributes: ['tx_id', 'block_unixtime'],
    });
    // Map the transactions to the desired format
    const result = transactions.map((transaction) => ({
        tx_id: transaction.tx_id,
        block_unixtime: transaction.block_unixtime,
    }));
    return result;
}
export async function fetchTransactionsBatch(offset, BATCH_SIZE) {
    const transactions = await Transactions.findAll({
        attributes: [
            'tx_id',
            'pool_id',
            'event_id',
            'tx_hash',
            'block_number',
            'block_unixtime',
            'transaction_type',
            'trader',
            'tx_position',
        ],
        limit: BATCH_SIZE,
        offset: offset,
        raw: true,
        order: [
            ['block_number', 'ASC'],
            ['pool_id', 'ASC'],
        ],
    });
    return transactions;
}
export async function fetchTransactionsForBlock(blockNumber) {
    const transactions = await Transactions.findAll({
        attributes: [
            'tx_id',
            'pool_id',
            'event_id',
            'tx_hash',
            'block_number',
            'block_unixtime',
            'transaction_type',
            'trader',
            'tx_position',
        ],
        where: {
            block_number: blockNumber,
        },
        raw: true,
        order: [
            ['block_number', 'ASC'],
            ['pool_id', 'ASC'],
        ],
    });
    return transactions;
}
export async function getTotalTransactionsCount() {
    return await Transactions.count();
}
export async function getTxHashByTxId(tx_id) {
    try {
        const transaction = await Transactions.findOne({
            attributes: ['tx_hash'],
            where: {
                tx_id: tx_id,
            },
        });
        if (transaction) {
            return transaction.tx_hash;
        }
        else {
            console.log(`Transaction with tx_id ${tx_id} not found.`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error while fetching transaction with tx_id ${tx_id}: ${error}`);
        return null;
    }
}
export async function getTxIdByTxHash(tx_hash) {
    try {
        const transaction = await Transactions.findOne({
            where: {
                tx_hash: tx_hash,
            },
        });
        if (transaction) {
            return transaction.tx_id;
        }
        else {
            console.log(`Transaction with tx_hash ${tx_hash} not found.`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error while fetching transaction with tx_hash ${tx_hash}: ${error}`);
        return null;
    }
}
export async function getAllUniqueTransactionHashes() {
    const transactions = await Transactions.findAll({
        attributes: ['tx_hash'],
        group: ['tx_hash'],
    });
    return transactions.map((transaction) => transaction.tx_hash);
}
export async function getTransactionTypeByEventId(event_id) {
    const transaction = await Transactions.findOne({
        where: {
            event_id,
        },
    });
    return transaction ? transaction.transaction_type : null;
}
export async function getTxIdByEventId(event_id) {
    try {
        const transaction = await Transactions.findOne({
            where: { event_id },
        });
        if (transaction) {
            return transaction.tx_id;
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error('Error fetching transaction by event ID:', error);
        return null;
    }
}
export async function getAllTxIdsByTxHash(txHash) {
    try {
        const transactions = await Transactions.findAll({
            where: {
                tx_hash: {
                    [Op.iLike]: txHash,
                },
            },
            attributes: ['tx_id'],
        });
        const txIds = transactions.map((transaction) => transaction.tx_id);
        return txIds;
    }
    catch (error) {
        console.error('Error fetching transaction IDs by transaction hash:', error);
        return [];
    }
}
export async function getEventIdByTxId(txId) {
    try {
        const transaction = await Transactions.findByPk(txId, {
            attributes: ['event_id'],
        });
        return transaction && transaction.event_id !== undefined ? transaction.event_id : null;
    }
    catch (error) {
        console.error('Error fetching event ID by transaction ID:', error);
        return null;
    }
}
export async function getPoolIdByTxId(txId) {
    var _a;
    try {
        const transaction = await Transactions.findByPk(txId, {
            attributes: ['pool_id'],
        });
        return (_a = transaction === null || transaction === void 0 ? void 0 : transaction.pool_id) !== null && _a !== void 0 ? _a : null;
    }
    catch (error) {
        console.error('Error fetching pool ID by transaction ID:', error);
        return null;
    }
}
export async function getAllTransactionIds() {
    try {
        const transactions = await Transactions.findAll({
            attributes: ['tx_id'],
            order: [['tx_id', 'ASC']],
            raw: true,
        });
        return transactions.map((t) => t.tx_id);
    }
    catch (error) {
        console.error('Error fetching transaction IDs:', error);
        return [];
    }
}
export async function fetchTransactionsForPoolAndTime(poolId, startUnixtime, endUnixtime) {
    return Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: startUnixtime,
                [Op.lt]: endUnixtime,
            },
            transaction_type: {
                [Op.in]: [TransactionType.Swap, TransactionType.Deposit, TransactionType.Remove],
            },
        },
        include: [
            {
                model: TransactionCoins,
                required: true,
            },
        ],
    });
}
export async function fetchTransactionsWithCoinsByTxIds(txIds) {
    return Transactions.findAll({
        where: {
            tx_id: txIds,
        },
        include: [
            {
                model: TransactionCoins,
                required: true,
            },
        ],
    });
}
export async function getUnixTimestampByTxId(txId) {
    try {
        const transaction = await Transactions.findOne({
            where: { tx_id: txId },
            attributes: ['block_unixtime'],
        });
        if (transaction) {
            return transaction.block_unixtime;
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error('Error fetching transaction data:', error);
        throw error;
    }
}
export async function getHighestBlockNumberForTransactions(poolId) {
    try {
        const result = await Transactions.max('block_number', { where: { pool_id: poolId } });
        return typeof result === 'number' ? result : null;
    }
    catch (error) {
        console.error('Error fetching highest block number from transactions: ', error);
        return null;
    }
}
export async function getLowestBlockNumberForTransactions(poolId) {
    try {
        const result = await Transactions.min('block_number', { where: { pool_id: poolId } });
        return typeof result === 'number' ? result : null;
    }
    catch (error) {
        console.error('Error fetching highest block number from transactions: ', error);
        return null;
    }
}
/**
 * Gets the time in days since the last transaction for a given pool ID.
 * @param poolId The pool ID to query.
 * @returns The time in days since the last transaction, or null if no transactions found.
 */
export async function getTimeSinceLastTransactionInDays(poolId) {
    const latestTransaction = await Transactions.findOne({
        where: { pool_id: poolId },
        order: [['block_unixtime', 'DESC']],
        attributes: ['block_unixtime'],
        raw: true,
    });
    if (!latestTransaction) {
        return null; // No transactions found for the given pool ID
    }
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const lastTransactionTime = latestTransaction.block_unixtime; // Assuming block_unixtime is stored in seconds
    const timeDiffInSeconds = currentTime - lastTransactionTime;
    const timeDiffInDays = timeDiffInSeconds / 86400; // Convert seconds to days
    return timeDiffInDays; // Time in days since the last transaction
}
export async function getLatestTransactionTimeForAllPools() {
    const latestTransactions = await Transactions.findAll({
        attributes: ['pool_id', [fn('MAX', col('block_unixtime')), 'latestBlockUnixtime']],
        group: ['pool_id'],
        raw: true,
    });
    return latestTransactions;
}
export async function getBlockNumberFromTxId(txId) {
    try {
        const transaction = await Transactions.findByPk(txId);
        if (transaction) {
            return transaction.block_number;
        }
        else {
            console.log(`Transaction with ID ${txId} not found.`);
            return null;
        }
    }
    catch (error) {
        console.error('Error fetching transaction block number:', error);
        return null;
    }
}
export async function fetchTxHashesForPoolAndTime(poolId, startUnixtime, endUnixtime) {
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: startUnixtime,
                [Op.lt]: endUnixtime,
            },
            transaction_type: {
                [Op.in]: [TransactionType.Swap, TransactionType.Deposit, TransactionType.Remove],
            },
        },
        attributes: ['tx_hash'],
    });
    const txHashes = transactions.map((transaction) => transaction.tx_hash);
    return txHashes;
}
export async function fetchTxPositionByTxId(txId) {
    try {
        const transaction = await Transactions.findOne({
            where: { tx_id: txId },
            attributes: ['tx_position'],
        });
        if (transaction) {
            return transaction.tx_position;
        }
        else {
            console.log(`Transaction with ID ${txId} not found.`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error fetching transaction position for txId ${txId}:`, error);
        return null;
    }
}
//# sourceMappingURL=Transactions.js.map