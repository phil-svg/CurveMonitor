import { TransactionDetails } from "../../models/TransactionDetails.js";
import { Transactions } from "../../models/Transactions.js";
import { findAndCountUniqueCallesPlusCalledContracts } from "../postgresTables/readFunctions/TransactionDetails.js";
import { priceTransactionFromTxId } from "../TokenPrices/txValue/PriceTransaction.js";
import { Op } from "sequelize";
import { Pool } from "../../models/Pools.js";
import { getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { Receipts } from "../../models/Receipts.js";
export async function findAndSortAllVolsPerUniqueAddressesFromAll() {
    try {
        const uniqueAddresses = await findAndCountUniqueCallesPlusCalledContracts();
        const addressVolumes = [];
        const totalAddresses = uniqueAddresses.length;
        console.log(`Total unique addresses to process: ${totalAddresses}`);
        for (let i = 0; i < totalAddresses; i++) {
            const { address } = uniqueAddresses[i];
            let totalVolume = 0;
            console.log(`\nProcessing address ${i + 1} of ${totalAddresses}: ${address}`);
            const transactions = await Transactions.findAll({
                include: [
                    {
                        model: TransactionDetails,
                        required: true,
                        where: {
                            [Op.or]: [{ from: { [Op.iLike]: address } }, { to: { [Op.iLike]: address } }],
                        },
                    },
                ],
                raw: true,
            });
            console.log("transactions.length", transactions.length);
            for (let j = 0; j < transactions.length; j++) {
                const transaction = transactions[j];
                const volume = await priceTransactionFromTxId(transaction.tx_id);
                if (volume !== null) {
                    totalVolume += volume;
                }
                if ((j + 1) % 100 === 0 || j === transactions.length - 1) {
                    console.log(`Processed ${j + 1} transactions for address ${address}`);
                }
            }
            addressVolumes.push({ address, totalVolume });
            console.log(`Completed processing for address ${address}. Total volume: ${totalVolume}`);
        }
        addressVolumes.sort((a, b) => b.totalVolume - a.totalVolume);
        console.log("Completed processing all addresses.");
        return addressVolumes;
    }
    catch (error) {
        console.error("Error fetching address volumes:", error);
        return [];
    }
}
export async function getTxIdsForPoolAndTargetAddress(poolAddress, targetAddress) {
    try {
        const targetAddressLower = targetAddress.toLowerCase();
        const pool = await Pool.findOne({
            where: { address: { [Op.iLike]: poolAddress.toLowerCase() } },
        });
        if (!pool) {
            console.log(`Pool with address ${poolAddress} not found.`);
            return [];
        }
        // Find all transactions for the pool
        const transactions = await Transactions.findAll({
            where: { pool_id: pool.id },
            include: {
                model: TransactionDetails,
                required: true,
            },
        });
        // Filter and extract txIds where 'to' matches targetAddress
        const matchingTxIds = transactions.filter((tx) => tx.transactionDetails && tx.transactionDetails.to.toLowerCase() === targetAddressLower).map((tx) => tx.tx_id);
        return matchingTxIds;
    }
    catch (error) {
        console.error("Error fetching transaction IDs:", error);
        return [];
    }
}
// Helper function to convert date strings to Unix time
const convertDateToUnixTime = (dateString) => {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
};
export async function getTxIdsForPoolForGiven_Duration(poolAddress, startDate, endDate) {
    try {
        const pool = await Pool.findOne({
            where: { address: { [Op.iLike]: poolAddress.toLowerCase() } },
        });
        if (!pool) {
            console.log(`Pool with address ${poolAddress} not found.`);
            return [];
        }
        // Convert the start and end dates to Unix timestamps
        const startUnix = convertDateToUnixTime(startDate);
        const endUnix = convertDateToUnixTime(endDate);
        const transactions = await Transactions.findAll({
            where: {
                pool_id: pool.id,
                block_unixtime: {
                    [Op.gte]: startUnix,
                    [Op.lte]: endUnix,
                },
            },
            attributes: ["tx_id"],
        });
        const txIds = transactions.map((transaction) => transaction.tx_id);
        return txIds;
    }
    catch (error) {
        console.error("Error fetching transaction IDs:", error);
        return [];
    }
}
export async function getTxIdsForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate) {
    const poolId = await getIdByAddress(poolAddress);
    if (poolId === null) {
        console.log(`Pool with address ${poolAddress} not found.`);
        return [];
    }
    const startUnix = convertDateToUnixTime(startDate);
    const endUnix = convertDateToUnixTime(endDate);
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            trader: { [Op.iLike]: targetAddress },
            block_unixtime: {
                [Op.gte]: startUnix,
                [Op.lte]: endUnix,
            },
        },
        attributes: ["tx_id"],
    });
    return transactions.map((tx) => tx.tx_id);
}
export async function getGasUsedArrayForAllTxForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate) {
    const poolId = await getIdByAddress(poolAddress);
    if (poolId === null) {
        console.log(`Pool with address ${poolAddress} not found.`);
        return [];
    }
    const startUnix = convertDateToUnixTime(startDate);
    const endUnix = convertDateToUnixTime(endDate);
    // Query the transactions
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            trader: { [Op.iLike]: targetAddress.toLowerCase() },
            block_unixtime: {
                [Op.gte]: startUnix,
                [Op.lte]: endUnix,
            },
        },
        include: [
            {
                model: Receipts,
                required: true,
            },
        ],
        attributes: ["tx_id", "tx_hash"],
    });
    // Extract gas used from each transaction
    return transactions.map((tx) => {
        if (tx.receipts && tx.receipts.length > 0) {
            const gasUsed = parseInt(tx.receipts[0].gasUsed, 10);
            return isNaN(gasUsed) ? 0 : gasUsed;
        }
        return 0; // Return 0 if no receipt is associated
    });
}
export async function getTxHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate, txHashArrLength, lowerGasUsageBoundary, biggerGasUsageBoundary) {
    const poolId = await getIdByAddress(poolAddress);
    if (poolId === null) {
        console.log(`Pool with address ${poolAddress} not found.`);
        return [];
    }
    const startUnix = convertDateToUnixTime(startDate);
    const endUnix = convertDateToUnixTime(endDate);
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            trader: { [Op.iLike]: targetAddress.toLowerCase() },
            block_unixtime: {
                [Op.gte]: startUnix,
                [Op.lte]: endUnix,
            },
        },
        include: [
            {
                model: Receipts,
                required: true,
            },
        ],
        attributes: ["tx_hash"],
    });
    // Filter transactions based on the gas used in the first receipt
    const filteredTransactions = transactions
        .filter((tx) => {
        if (tx.receipts && tx.receipts.length > 0) {
            const gasUsed = parseInt(tx.receipts[0].gasUsed, 10);
            return !isNaN(gasUsed) && gasUsed >= lowerGasUsageBoundary && gasUsed <= biggerGasUsageBoundary;
        }
        return false;
    })
        .slice(0, txHashArrLength);
    // Extract and return transaction hashes
    return filteredTransactions.map((tx) => tx.tx_hash);
}
//# sourceMappingURL=CrossQueries.js.map