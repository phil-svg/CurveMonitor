import { Op, QueryTypes, Sequelize } from 'sequelize';
import { TransactionDetails } from '../../../models/TransactionDetails.js';
import { sequelize } from '../../../config/Database.js';
export async function getFromAddress(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    if (transactionDetails) {
        return transactionDetails.from;
    }
    return null;
}
export async function getToAddress(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    if (transactionDetails) {
        return transactionDetails.to;
    }
    return null;
}
export async function getTransactionDetails(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    return transactionDetails || null;
}
/**
 * Retrieves the 'to' address of a transaction by its ID.
 * @param txId The ID of the transaction.
 * @returns The 'to' address as a string or null if not found or on error.
 */
export async function getToAddressByTxId(txId) {
    try {
        const transactionDetails = await TransactionDetails.findByPk(txId, {
            attributes: ['to'], // Fetch only the 'to' field
        });
        if (transactionDetails && transactionDetails.to) {
            return transactionDetails.to;
        }
        else {
            console.log(`Transaction with txId ${txId} not found or missing 'to' address.`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error fetching transaction details for txId ${txId}: ${error}`);
        return null;
    }
}
export async function getTransactionDetailsByTxId(txId) {
    const transactionDetails = await TransactionDetails.findByPk(txId);
    return transactionDetails || null;
}
export function extractTransactionAddresses(transactionDetails) {
    if (transactionDetails) {
        return { from: transactionDetails.from, to: transactionDetails.to };
    }
    return { from: null, to: null };
}
export async function getAllTxIdsPresentInTransactionsDetails() {
    const transactionDetails = await TransactionDetails.findAll({
        attributes: ['txId'],
    });
    return transactionDetails.map((txDetail) => txDetail.txId);
}
export function extractGasPrice(transactionDetails) {
    if (transactionDetails) {
        return transactionDetails.gasPrice;
    }
    return null;
}
export async function getBlockNumberByTxHash(hash) {
    const transactionDetail = await TransactionDetails.findOne({ where: { hash: hash } });
    if (transactionDetail) {
        return transactionDetail.blockNumber;
    }
    return null;
}
export async function countTransactionsToAddress(address) {
    const count = await TransactionDetails.count({
        where: {
            to: {
                [Op.iLike]: address,
            },
        },
    });
    return count;
}
export async function getTxdsForRequestedToAddress(address) {
    const transactions = await TransactionDetails.findAll({
        attributes: ['txId'],
        where: {
            to: {
                [Op.iLike]: address,
            },
        },
    });
    return transactions.map((transaction) => transaction.txId);
}
export async function findAndCountUniqueCallesPlusCalledContracts() {
    try {
        const addresses = await TransactionDetails.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('from')), 'address'],
                [Sequelize.fn('COUNT', Sequelize.col('from')), 'count'],
            ],
            group: 'from',
            raw: true,
        });
        const toAddresses = await TransactionDetails.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('to')), 'address'],
                [Sequelize.fn('COUNT', Sequelize.col('to')), 'count'],
            ],
            group: 'to',
            raw: true,
        });
        // Combine and reduce the arrays to sum up counts for each address
        const combinedAddresses = [...addresses, ...toAddresses];
        const addressCounts = combinedAddresses.reduce((acc, curr) => {
            const address = curr.address;
            const count = parseInt(curr.count, 10);
            acc[address] = (acc[address] || 0) + count;
            return acc;
        }, {});
        // Convert the object back into an array
        return Object.entries(addressCounts).map(([address, count]) => ({ address, count }));
    }
    catch (error) {
        console.error('Error fetching address occurrence counts:', error);
        return [];
    }
}
export async function getAddressOccurrenceCounts() {
    try {
        const addresses = await TransactionDetails.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('from')), 'address'],
                [Sequelize.fn('COUNT', Sequelize.col('from')), 'count'],
            ],
            group: 'from',
            raw: true,
        });
        const toAddresses = await TransactionDetails.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('to')), 'address'],
                [Sequelize.fn('COUNT', Sequelize.col('to')), 'count'],
            ],
            group: 'to',
            raw: true,
        });
        // Combine and reduce the arrays to sum up counts for each address
        const combinedAddresses = [...addresses, ...toAddresses];
        const addressCounts = combinedAddresses.reduce((acc, curr) => {
            const address = curr.address;
            const count = parseInt(curr.count, 10);
            acc[address] = (acc[address] || 0) + count;
            return acc;
        }, {});
        // Convert the object back into an array
        return Object.entries(addressCounts).map(([address, count]) => ({ address, count }));
    }
    catch (error) {
        console.error('Error fetching address occurrence counts:', error);
        return [];
    }
}
/**
 * Fetches all transaction IDs from TransactionDetails where the 'to' field is null.
 * @returns A Promise resolving to an array of objects containing txIds.
 */
export async function getTxIdsWhereToIsNull() {
    const query = `
    SELECT tx_id
    FROM transaction_details
    WHERE "to" IS NULL
    ORDER BY tx_id ASC;
  `;
    try {
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
        });
        return result.map((item) => ({
            txId: item.tx_id,
        }));
    }
    catch (error) {
        console.error(`Error fetching transaction IDs where 'to' is null: ${error}`);
        return [];
    }
}
//# sourceMappingURL=TransactionDetails.js.map