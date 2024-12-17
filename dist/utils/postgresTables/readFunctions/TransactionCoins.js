var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { TransactionCoins } from '../../../models/TransactionCoins.js';
import { Coins } from '../../../models/Coins.js';
import { Op, QueryTypes, Sequelize } from 'sequelize';
import { Transactions } from '../../../models/Transactions.js';
export async function findTransactionCoinsByTxIds(tx_ids) {
    const transactionCoins = await TransactionCoins.findAll({
        where: {
            tx_id: {
                [Op.in]: tx_ids,
            },
            amount: {
                [Op.ne]: 0,
            },
        },
        include: [
            {
                model: Coins,
                as: 'coin',
            },
        ],
    });
    return transactionCoins.map((transactionCoin) => {
        const _a = transactionCoin.toJSON(), { createdAt, updatedAt, coin } = _a, rest = __rest(_a, ["createdAt", "updatedAt", "coin"]);
        const { createdAt: coinCreatedAt, updatedAt: coinUpdatedAt } = coin, coinRest = __rest(coin, ["createdAt", "updatedAt"]);
        rest.amount = rest.amount.toString();
        return Object.assign(Object.assign({}, rest), { coin: coinRest });
    });
}
export async function getAllCoinIds() {
    const coinIds = await TransactionCoins.findAll({
        attributes: ['coin_id'],
        group: ['coin_id'],
    });
    return coinIds.map((transactionCoin) => transactionCoin.coin_id);
}
export async function countEntriesWithNullDollarValue() {
    const count = await TransactionCoins.count({
        where: {
            dollar_value: null,
        },
    });
    return count;
}
export async function getTotalEntries() {
    const totalEntries = await TransactionCoins.count();
    return totalEntries;
}
export async function countNullDollarValueForCoin(coin_id) {
    const count = await TransactionCoins.count({
        where: {
            coin_id: coin_id,
            dollar_value: null,
        },
    });
    return count;
}
export async function getTotalEntriesForCoin(coin_id) {
    const totalEntries = await TransactionCoins.count({
        where: {
            coin_id: coin_id,
        },
    });
    return totalEntries;
}
// given a coin, this function will look for swaps that had this coin involved, and returns all counter-part-coins of these Swaps.
export async function getAllUniqueSwapCounterPartCoinIds(coinId) {
    // Find all tx_ids that have both 'in' and 'out' directions
    const transactionIdsWithBothDirections = (await TransactionCoins.sequelize.query(`
      SELECT tx_id FROM transaction_coins
      WHERE tx_id IN (
        SELECT tx_id FROM transaction_coins WHERE coin_id = :coinId
      ) AND tx_id IN (
        SELECT tx_id FROM transaction_coins
        WHERE direction IN ('in', 'out')
        GROUP BY tx_id
        HAVING COUNT(DISTINCT direction) = 2
      )
      `, {
        replacements: { coinId },
        type: QueryTypes.SELECT,
    })).map((transaction) => transaction.tx_id);
    // From those transactions, find all the entries that do not have the input coinId
    const otherCoinEntries = await TransactionCoins.findAll({
        where: {
            tx_id: {
                [Op.in]: transactionIdsWithBothDirections,
            },
            coin_id: {
                [Op.ne]: coinId,
            },
        },
    });
    // Extract the coin_id of the other entries
    const swapCoinIds = new Set();
    otherCoinEntries.forEach((transactionCoin) => {
        swapCoinIds.add(transactionCoin.coin_id);
    });
    // Convert the Set back to an array before returning
    return Array.from(swapCoinIds);
}
// copies dollar-values over in swaps (valueIn = valueOut)
export async function findAndModifySwapTransactions(coinId1, coinId2) {
    // First, find all transaction IDs where the two coins got exchanged
    const transactionIds = (await TransactionCoins.sequelize.query(`
      SELECT tx_id FROM transaction_coins
      WHERE coin_id IN (:coinId1, :coinId2)
      GROUP BY tx_id
      HAVING COUNT(DISTINCT coin_id) = 2 AND COUNT(DISTINCT direction) = 2
      `, {
        replacements: { coinId1, coinId2 },
        type: QueryTypes.SELECT,
    })).map((transaction) => transaction.tx_id);
    // Now, for each transaction ID, fetch the two entries
    for (let tx_id of transactionIds) {
        const transactionCoins = await TransactionCoins.findAll({
            where: {
                tx_id: tx_id,
            },
        });
        // Ensure that there are exactly 2 entries for the transaction
        if (transactionCoins.length !== 2)
            continue;
        // Identify the entry corresponding to the first coin
        const entryCoin1 = transactionCoins.find((transactionCoin) => transactionCoin.coin_id === coinId1);
        // If the entry for the first coin doesn't exist or doesn't have a dollar value, skip this transaction
        if (!entryCoin1 || !entryCoin1.dollar_value)
            continue;
        // Identify the entry corresponding to the second coin
        const entryCoin2 = transactionCoins.find((transactionCoin) => transactionCoin.coin_id === coinId2);
        // If the entry for the second coin doesn't exist, skip this transaction
        if (!entryCoin2)
            continue;
        // Paste the dollar value from the first entry to the second
        entryCoin2.dollar_value = entryCoin1.dollar_value;
        // Save the modified entry for the second coin
        await entryCoin2.save();
    }
}
export async function findSwapsForCoin(coinId) {
    // First, find all tx_ids involving the input coin
    const transactionsInvolvingCoin = await TransactionCoins.findAll({
        where: {
            coin_id: coinId,
        },
    });
    const transactionIdsInvolvingCoin = transactionsInvolvingCoin.map((transaction) => transaction.tx_id);
    // Then find all tx_ids that have both 'in' and 'out' directions among those involving the input coin
    const swapTransactionIds = (await TransactionCoins.findAll({
        attributes: ['tx_id'],
        where: {
            tx_id: {
                [Op.in]: transactionIdsInvolvingCoin,
            },
            direction: {
                [Op.in]: ['in', 'out'],
            },
        },
        group: ['tx_id'],
        having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('direction')), 2),
    })).map((transaction) => transaction.tx_id);
    return swapTransactionIds;
}
export async function findSwapTransactionsForTwoCoins(coinId1, coinId2) {
    // First, find all tx_ids involving the two input coins
    const transactionsInvolvingCoin1 = await TransactionCoins.findAll({
        where: {
            coin_id: coinId1,
        },
    });
    const transactionsInvolvingCoin2 = await TransactionCoins.findAll({
        where: {
            coin_id: coinId2,
        },
    });
    const transactionIdsInvolvingCoin1 = transactionsInvolvingCoin1.map((transaction) => transaction.tx_id);
    const transactionIdsInvolvingCoin2 = transactionsInvolvingCoin2.map((transaction) => transaction.tx_id);
    // Then find all tx_ids that are common to both coins and that have both 'in' and 'out' directions
    const commonTransactionIds = transactionIdsInvolvingCoin1.filter((id) => transactionIdsInvolvingCoin2.includes(id));
    const swapTransactionIds = (await TransactionCoins.findAll({
        attributes: ['tx_id'],
        where: {
            tx_id: {
                [Op.in]: commonTransactionIds,
            },
            direction: {
                [Op.in]: ['in', 'out'],
            },
        },
        group: ['tx_id'],
        having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('direction')), 2),
    })).map((transaction) => transaction.tx_id);
    return swapTransactionIds;
}
export async function findTransactionIdsForCoinWithNullDollarValue(coinId) {
    // Find all transactions involving the input coin where dollar_value is null
    const transactionsInvolvingCoin = await TransactionCoins.findAll({
        where: {
            coin_id: coinId,
            dollar_value: {
                [Op.is]: null, // is null
            },
        },
    });
    // Extract all transaction ids and remove duplicates
    const transactionIds = [...new Set(transactionsInvolvingCoin.map((transaction) => transaction.tx_id))];
    return transactionIds;
}
export async function getPriceArrayFromSwapEntries(coinId) {
    const transactionEntries = await TransactionCoins.findAll({
        where: {
            coin_id: coinId,
            dollar_value: {
                [Op.ne]: null, // dollar_value is not null
            },
        },
        include: [
            {
                model: Transactions,
                required: true,
            },
        ],
    });
    return transactionEntries.map((entry) => ({
        unixtime: entry.transaction.block_unixtime,
        price: entry.dollar_value / entry.amount,
    }));
}
export async function findAllFullyPricedCoinsIds() {
    // Find all distinct coin_ids
    const allCoins = await TransactionCoins.findAll({
        attributes: ['coin_id'],
        group: ['coin_id'],
    });
    // Find coin_ids that have at least one null dollar_value
    const partiallyPricedCoins = await TransactionCoins.findAll({
        where: {
            dollar_value: null,
        },
        attributes: ['coin_id'],
        group: ['coin_id'],
    });
    const partiallyPricedCoinIds = partiallyPricedCoins.map((transaction) => transaction.coin_id);
    // Filter out the coin_ids that have at least one null dollar_value
    const fullyPricedCoinIds = allCoins
        .map((transaction) => transaction.coin_id)
        .filter((coin_id) => !partiallyPricedCoinIds.includes(coin_id));
    return fullyPricedCoinIds;
}
export async function fetchAllTransactionCoinData(txId) {
    try {
        const transactionCoinsData = await TransactionCoins.findAll({
            where: { tx_id: txId },
            include: [
                { model: Transactions, as: 'transaction' },
                { model: Coins, as: 'coin' },
            ],
        });
        return transactionCoinsData;
    }
    catch (error) {
        console.error('Error fetching all transaction coin data:', error);
        return [];
    }
}
//# sourceMappingURL=TransactionCoins.js.map