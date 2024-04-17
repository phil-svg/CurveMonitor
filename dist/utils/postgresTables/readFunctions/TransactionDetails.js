import { Op, Sequelize } from 'sequelize';
import { TransactionDetails } from '../../../models/TransactionDetails.js';
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
//# sourceMappingURL=TransactionDetails.js.map