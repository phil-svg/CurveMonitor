import { Op } from "sequelize";
import { TransactionDetails } from "../../../models/TransactionDetails.js";
import { Transactions } from "../../../models/Transactions.js";
import { priceTransactionFromTxId } from "../../TokenPrices/txValue/PriceTransaction.js";
import { saveMostVolGeneratingToAddressesToExcel } from "../utils/Excel.js";
import { getTxHashByTxId } from "../../postgresTables/readFunctions/Transactions.js";
import { getPoolIdsFromPoolAddresses } from "../../postgresTables/readFunctions/Pools.js";
async function groupTransactionsByFromAddress(startUnixtime, endUnixtime) {
    let offset = 0;
    const limit = 10000; // Adjust based on your memory constraints
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
    const limit = 10000; // Adjust based on your memory constraints
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
    const limit = 10000; // Adjust based on your memory constraints
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
    console.log("starting calculateTotalVolumeForAddresses");
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
export async function generateTopToVolAddresses(startUnixtime, endUnixtime) {
    const groupedTransactions = await groupTransactionsByToAddress(startUnixtime, endUnixtime);
    const volumeForAddress = await calculateTotalVolumeForAddresses(groupedTransactions);
    const topAddresses = await findTop20AddressesByVolume(volumeForAddress);
    await saveMostVolGeneratingToAddressesToExcel(topAddresses);
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
export async function generateTopFromVolAddresses(startUnixtime, endUnixtime) {
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
            include: [{ model: Transactions, as: "transaction" }],
            offset,
            limit: batchSize,
        });
        for (const detail of transactionDetails) {
            const txVolume = await priceTransactionFromTxId(detail.txId);
            if (txVolume && txVolume > 1e9) {
                const txHash = await getTxHashByTxId(detail.txId);
                console.log("potentially tx with more than 1B in size:", detail.txId, txHash, txVolume);
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
    console.log("Final Total Volume Calculated: ", totalVolume);
    return totalVolume;
}
//# sourceMappingURL=Volume.js.map