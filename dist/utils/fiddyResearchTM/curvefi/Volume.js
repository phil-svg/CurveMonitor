import { Op } from 'sequelize';
import { TransactionDetails } from '../../../models/TransactionDetails.js';
import { Transactions } from '../../../models/Transactions.js';
import { priceTransactionFromTxId } from '../../TokenPrices/txValue/PriceTransaction.js';
import { saveMostVolGeneratingToAddressesToExcel } from '../utils/Excel.js';
import { getTxHashByTxId } from '../../postgresTables/readFunctions/Transactions.js';
import { getNameBy, getPoolIdsFromPoolAddresses } from '../../postgresTables/readFunctions/Pools.js';
import { convertDateToUnixTime } from '../../helperFunctions/QualityOfLifeStuff.js';
import { Pool } from '../../../models/Pools.js';
import { findPoolId } from '../cexdex/ClusteredTxCoins.js';
import { TransactionCoins } from '../../../models/TransactionCoins.js';
import { Coins } from '../../../models/Coins.js';
import { getFromAddress } from '../../postgresTables/readFunctions/TransactionDetails.js';
import * as XLSX from 'xlsx';
async function groupTransactionsByFromAddress(startUnixtime, endUnixtime) {
    let offset = 0;
    const limit = 10000;
    let transactions;
    const groupedByTo = {};
    do {
        transactions = await TransactionDetails.findAll({
            include: [
                {
                    model: Transactions,
                    required: true,
                    where: {
                        block_unixtime: {
                            [Op.gte]: startUnixtime,
                            [Op.lte]: endUnixtime,
                        },
                    },
                },
            ],
            limit,
            offset,
        });
        transactions.forEach((txDetail) => {
            const toAddress = txDetail.from;
            if (groupedByTo[toAddress]) {
                groupedByTo[toAddress].push(txDetail.txId);
            }
            else {
                groupedByTo[toAddress] = [txDetail.txId];
            }
        });
        console.log(`Processed ${offset + transactions.length} transactions...`);
        offset += limit;
    } while (transactions.length === limit);
    return groupedByTo;
}
async function groupTransactionsByToAddress(startUnixtime, endUnixtime) {
    let offset = 0;
    const limit = 10000;
    let transactions;
    const groupedByTo = {};
    do {
        transactions = await TransactionDetails.findAll({
            include: [
                {
                    model: Transactions,
                    required: true,
                    where: {
                        block_unixtime: {
                            [Op.gte]: startUnixtime,
                            [Op.lte]: endUnixtime,
                        },
                    },
                },
            ],
            limit,
            offset,
        });
        transactions.forEach((txDetail) => {
            const toAddress = txDetail.to;
            if (groupedByTo[toAddress]) {
                groupedByTo[toAddress].push(txDetail.txId);
            }
            else {
                groupedByTo[toAddress] = [txDetail.txId];
            }
        });
        console.log(`Processed ${offset + transactions.length} transactions...`);
        offset += limit;
    } while (transactions.length === limit);
    return groupedByTo;
}
async function groupTransactionsByToAddressForSelectedPools(poolIds, startUnixtime, endUnixtime) {
    let offset = 0;
    const limit = 10000;
    let transactions;
    const groupedByTo = {};
    do {
        transactions = await TransactionDetails.findAll({
            include: [
                {
                    model: Transactions,
                    required: true,
                    where: {
                        block_unixtime: {
                            [Op.gte]: startUnixtime,
                            [Op.lte]: endUnixtime,
                        },
                        pool_id: {
                            [Op.in]: poolIds,
                        },
                    },
                },
            ],
            limit,
            offset,
        });
        transactions.forEach((txDetail) => {
            const toAddress = txDetail.to;
            if (groupedByTo[toAddress]) {
                groupedByTo[toAddress].push(txDetail.txId);
            }
            else {
                groupedByTo[toAddress] = [txDetail.txId];
            }
        });
        console.log(`Processed ${offset + transactions.length} transactions...`);
        offset += limit;
    } while (transactions.length === limit);
    return groupedByTo;
}
async function calculateTotalVolumeForAddresses(groupedTransactions) {
    console.log('starting calculateTotalVolumeForAddresses');
    const volumeForAddress = {};
    let processedCount = 0;
    for (const [address, txIds] of Object.entries(groupedTransactions)) {
        let totalVolume = 0;
        for (const txId of txIds) {
            const volume = await priceTransactionFromTxId(txId);
            totalVolume += volume || 0;
        }
        volumeForAddress[address] = totalVolume;
        processedCount++;
        console.log(`Processed ${processedCount} addresses...`);
    }
    return volumeForAddress;
}
async function findTop20AddressesByVolume(volumeForAddress) {
    return Object.entries(volumeForAddress)
        .sort(([, volumeA], [, volumeB]) => volumeB - volumeA)
        .slice(0, 20);
}
export async function generateTopToVolAddresses(startDate, endDate) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    const groupedTransactions = await groupTransactionsByToAddress(startUnixtime, endUnixtime);
    const volumeForAddress = await calculateTotalVolumeForAddresses(groupedTransactions);
    const topAddresses = await findTop20AddressesByVolume(volumeForAddress);
    await saveMostVolGeneratingToAddressesToExcel(topAddresses);
}
export async function getToAddressVolDistributionPerPools(toAddress, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const groupedTransactions = await groupTransactionsByToAddressAndPool(startUnixTime, endUnixTime, toAddress.toLowerCase());
    const volumeForPool = await calculateTotalVolumeForPools(groupedTransactions);
    const rankedPoolsByVolume = rankPoolsByVolume(volumeForPool);
    const res = await enrichPoolDataWithNames(rankedPoolsByVolume);
    console.log('res:', res);
}
async function groupTransactionsByToAddressAndPool(startUnixtime, endUnixtime, toAddress) {
    let offset = 0;
    const limit = 10000;
    let transactions;
    const groupedByPool = {};
    do {
        transactions = await TransactionDetails.findAll({
            include: [
                {
                    model: Transactions,
                    required: true,
                    where: {
                        block_unixtime: {
                            [Op.gte]: startUnixtime,
                            [Op.lte]: endUnixtime,
                        },
                    },
                    include: [
                        {
                            model: Pool,
                            required: true,
                        },
                    ],
                },
            ],
            where: {
                to: {
                    [Op.iLike]: toAddress,
                },
            },
            limit,
            offset,
        });
        transactions.forEach((tx) => {
            const poolAddress = tx.transaction.pool.address;
            const txId = tx.txId;
            if (groupedByPool[poolAddress]) {
                groupedByPool[poolAddress].push(txId);
            }
            else {
                groupedByPool[poolAddress] = [txId];
            }
        });
        console.log(`Processed ${offset + transactions.length} transactions...`);
        offset += limit;
    } while (transactions.length === limit);
    return groupedByPool;
}
export async function enrichPoolDataWithNames(poolVolumes) {
    const enrichedDataPromises = poolVolumes.slice(0, 18).map(async ([address, volume]) => {
        const name = await getNameBy({ address });
        return { address, volume, name };
    });
    const enrichedData = await Promise.all(enrichedDataPromises);
    return enrichedData;
}
async function calculateTotalVolumeForPools(groupedTransactions) {
    const volumeForPool = {};
    for (const [poolAddress, txIds] of Object.entries(groupedTransactions)) {
        let totalVolume = 0;
        for (const txId of txIds) {
            const volume = await priceTransactionFromTxId(txId);
            totalVolume += Number(volume === null || volume === void 0 ? void 0 : volume.toFixed(0)) || 0;
        }
        volumeForPool[poolAddress] = totalVolume;
    }
    return volumeForPool;
}
function rankPoolsByVolume(volumeForPool) {
    return Object.entries(volumeForPool).sort((a, b) => b[1] - a[1]);
}
export async function generateTopToVolAddressesForSelectedPools(poolAddresses, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolIds = await getPoolIdsFromPoolAddresses(poolAddresses);
    const groupedTransactions = await groupTransactionsByToAddressForSelectedPools(poolIds, startUnixTime, endUnixTime);
    const volumeForAddress = await calculateTotalVolumeForAddresses(groupedTransactions);
    const topAddresses = await findTop20AddressesByVolume(volumeForAddress);
    await saveMostVolGeneratingToAddressesToExcel(topAddresses);
}
export async function generateTopFromVolAddresses(startDate, endDate) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    const groupedTransactions = await groupTransactionsByFromAddress(startUnixtime, endUnixtime);
    const volumeForAddress = await calculateTotalVolumeForAddresses(groupedTransactions);
    const topAddresses = await findTop20AddressesByVolume(volumeForAddress);
    await saveMostVolGeneratingToAddressesToExcel(topAddresses);
}
export async function calculateTotalVolumeForTransactionsInDb() {
    let totalVolume = 0;
    let offset = 0;
    const batchSize = 10000;
    let hasMoreData = true;
    while (hasMoreData) {
        const transactionDetails = await TransactionDetails.findAll({
            include: [{ model: Transactions, as: 'transaction' }],
            offset,
            limit: batchSize,
        });
        for (const detail of transactionDetails) {
            const txVolume = await priceTransactionFromTxId(detail.txId);
            if (txVolume && txVolume > 1e9) {
                const txHash = await getTxHashByTxId(detail.txId);
                console.log('potentially tx with more than 1B in size:', detail.txId, txHash, txVolume);
            }
            totalVolume += txVolume || 0;
        }
        console.log(`Processed ${offset + transactionDetails.length} transactions... Total Volume: ${(totalVolume / 1e9).toFixed(0)}B$`);
        if (transactionDetails.length < batchSize) {
            hasMoreData = false;
        }
        else {
            offset += batchSize;
        }
    }
    console.log('Final Total Volume Calculated: ', totalVolume);
    return totalVolume;
}
export async function getSwapVolumeForPoolAndToAddressForEachSwapDirection(poolAddress, toAddress, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolId = await findPoolId(poolAddress);
    if (poolId === null) {
        console.log('Pool not found');
        return {};
    }
    // Fetch transactions for the pool within the time frame
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: startUnixTime,
                [Op.lte]: endUnixTime,
            },
        },
        include: [
            {
                model: TransactionDetails,
                where: { to: toAddress },
                required: true,
            },
            {
                model: TransactionCoins,
                include: [Coins],
            },
        ],
    });
    const swapData = {};
    transactions.forEach((transaction) => {
        console.log(`\nID: ${transaction.tx_id} ${transaction.tx_hash} | Coins involved: ${transaction.transactionCoins.length}`);
        const processedPairs = new Set(); // Keeps track of processed coin pairs to avoid double counting
        transaction.transactionCoins.forEach((txCoin) => {
            var _a;
            const direction = txCoin.direction;
            const coinSymbol = ((_a = txCoin.coin) === null || _a === void 0 ? void 0 : _a.symbol) || 'Unknown';
            // Instead of filtering transactionCoins again, directly work with already identified txCoin
            // This avoids re-identifying pairs already accounted for
            const otherCoins = transaction.transactionCoins.filter((c) => c.tx_id === txCoin.tx_id && c.coin_id !== txCoin.coin_id);
            otherCoins.forEach((otherCoin) => {
                var _a, _b;
                const otherCoinSymbol = ((_a = otherCoin.coin) === null || _a === void 0 ? void 0 : _a.symbol) || 'Unknown';
                // Ensure a unique identifier for each coin pair regardless of direction to prevent double counting
                const pairIdentifier = direction === 'in' ? `${otherCoin.coin_id}-${txCoin.coin_id}` : `${txCoin.coin_id}-${otherCoin.coin_id}`;
                // Skip this pair if it has already been processed
                if (processedPairs.has(pairIdentifier))
                    return;
                processedPairs.add(pairIdentifier); // Mark this pair as processed
                const swapDirection = direction === 'in' ? `${otherCoinSymbol}->${coinSymbol}` : `${coinSymbol}->${otherCoinSymbol}`;
                console.log(`Swap: ${swapDirection} | ID: ${transaction.tx_id}`);
                if (!swapData[swapDirection]) {
                    swapData[swapDirection] = { count: 0, totalVolume: 0 };
                }
                swapData[swapDirection].count += 1;
                swapData[swapDirection].totalVolume += parseFloat(((_b = txCoin.dollar_value) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
            });
        });
    });
    console.log('swapData', swapData);
    return swapData;
}
export async function generateTopFromVolAddressesForSpecificToAddress(startDate, endDate, specificToAddress) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    // Group transactions by "to" address within the specified timeframe
    const groupedTransactions = await groupTransactionsByToAddress(startUnixtime, endUnixtime);
    // Access transactions directed to the specific "to" address
    const txIdsForSpecificToAddress = groupedTransactions[specificToAddress] || [];
    if (txIdsForSpecificToAddress.length === 0) {
        console.log(`No transactions found for the specified "to" address: ${specificToAddress}`);
        return;
    }
    // Initialize a record to track volume by "from" address
    const volumeByFromAddress = {};
    // Retrieve "from" addresses and calculate volume
    for (const txId of txIdsForSpecificToAddress) {
        const fromAddress = await getFromAddress(txId);
        if (!fromAddress)
            continue;
        const volume = await priceTransactionFromTxId(txId);
        if (!volume)
            continue;
        if (volumeByFromAddress[fromAddress]) {
            volumeByFromAddress[fromAddress] += volume;
        }
        else {
            volumeByFromAddress[fromAddress] = volume;
        }
    }
    // Convert to array, sort, and take top 20
    const topFromAddresses = Object.entries(volumeByFromAddress)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([address, volume]) => ({ address, volume }));
    console.log('Top From Addresses by Volume:', topFromAddresses);
    console.log(`Total different 'from' addresses: ${Object.keys(volumeByFromAddress).length}`);
}
export async function getSwapVolumeBucketsForPoolAndToAddress(poolAddress, toAddress, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolId = await findPoolId(poolAddress);
    if (poolId === null) {
        console.log('Pool not found');
        return {};
    }
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: startUnixTime,
                [Op.lte]: endUnixTime,
            },
        },
        include: [
            {
                model: TransactionDetails,
                where: { to: toAddress },
                required: true,
            },
            {
                model: TransactionCoins,
                include: [Coins],
            },
        ],
    });
    const swapBuckets = {};
    transactions.forEach((transaction) => {
        transaction.transactionCoins.forEach((txCoin) => {
            if (!txCoin.dollar_value)
                return;
            const dollarVolume = parseFloat(txCoin.dollar_value.toString());
            if (dollarVolume < 100000)
                console.log(transaction.tx_hash, dollarVolume);
            const bucketRange = Math.floor(dollarVolume / 50000) * 50000;
            const bucketLabel = `$${bucketRange}-${bucketRange + 50000}`;
            if (!swapBuckets[bucketLabel]) {
                swapBuckets[bucketLabel] = { count: 0, totalVolume: 0 };
            }
            swapBuckets[bucketLabel].count += 1;
            swapBuckets[bucketLabel].totalVolume += dollarVolume;
        });
    });
    const dataForExcel = Object.entries(swapBuckets)
        .map(([label, { count, totalVolume }]) => {
        // Use match to find numbers in the label, handle possible null result
        const matchResult = label.match(/\d+/g);
        const [start, end] = matchResult ? matchResult.map(Number) : [0, 0]; // Default to [0, 0] if no match
        return {
            Bucket: `${start / 1000}k$-${end / 1000}k$`,
            Count: count,
            'Total Volume': totalVolume,
        };
    })
        .sort((a, b) => {
        // Extract numeric start values from Bucket labels for sorting
        const startValueA = parseInt(a.Bucket);
        const startValueB = parseInt(b.Bucket);
        return startValueA - startValueB;
    });
    // Create a new workbook and add the data
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Swap Volumes');
    const excelFileName = 'volBuckets.xlsx';
    // Write workbook to file
    XLSX.writeFile(workbook, excelFileName);
    console.log(`Results saved to ${excelFileName}`);
}
//# sourceMappingURL=Volume.js.map