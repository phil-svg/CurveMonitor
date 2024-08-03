import { TransactionType } from '../../../models/TransactionType.js';
import { Transactions } from '../../../models/Transactions.js';
import { TransactionCoins } from '../../../models/TransactionCoins.js';
import { getSandwichContentForPoolAndTime } from '../../postgresTables/readFunctions/Sandwiches.js';
import { fetchAtomicArbsForPoolAndTime } from '../../postgresTables/readFunctions/AtomicArbs.js';
import { fetchTransactionsForPoolAndTime, fetchTransactionsWithCoinsByTxIds, } from '../../postgresTables/readFunctions/Transactions.js';
import { fetchCexDexArbTxIdsForPoolAndTime } from '../../postgresTables/readFunctions/CexDexArbs.js';
import { solveRevenueLowerBoundInUSD } from '../../postgresTables/mevDetection/cexdex/utils/revenueProfitThings/LowerBoundSolver.js';
export function formatVolumeDataToJson(dailyVolumes, sandwichDailyVolumes, dailyAtomicArbVolumes, dailyCexDexArbVolumes) {
    // Combine all dates from all volume data sets into a Set to ensure uniqueness
    const uniqueDates = new Set();
    [dailyVolumes, sandwichDailyVolumes, dailyAtomicArbVolumes, dailyCexDexArbVolumes].forEach((data) => Object.keys(data).forEach((date) => uniqueDates.add(date)));
    // Sort the dates
    const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    // Consolidate the volume data into a structured JSON object
    const consolidatedData = {};
    sortedDates.forEach((date) => {
        // Calculate the volumes for the day
        const rounder = 1;
        const prec = 0;
        const dv = dailyVolumes[date] ? Number((Number(dailyVolumes[date].toFixed(0)) / rounder).toFixed(prec)) : 0;
        const sdv = sandwichDailyVolumes[date]
            ? Number((Number(sandwichDailyVolumes[date].toFixed(0)) / rounder).toFixed(prec))
            : 0;
        const aav = dailyAtomicArbVolumes[date]
            ? Number((Number(dailyAtomicArbVolumes[date].toFixed(0)) / rounder).toFixed(prec))
            : 0;
        const cdav = dailyCexDexArbVolumes[date]
            ? Number((Number(dailyCexDexArbVolumes[date].toFixed(0)) / rounder).toFixed(prec))
            : 0;
        // Calculate the gap
        const gap = dv - (sdv + aav + cdav);
        // Add to the consolidated data object
        consolidatedData[date] = [dv, sdv, aav, cdav, gap];
    });
    return consolidatedData;
}
export async function calculateDailyVolumes(poolId, startUnixtime, endUnixtime) {
    const transactions = await fetchTransactionsForPoolAndTime(poolId, startUnixtime, endUnixtime);
    // Calculate the volume for each transaction
    const dailyVolumes = transactions.reduce((acc, transaction) => {
        const day = new Date(transaction.block_unixtime * 1000).toISOString().split('T')[0];
        acc[day] = acc[day] || 0;
        transaction.transactionCoins.forEach((coin) => {
            if (coin.dollar_value != null) {
                const valueToAdd = Number(coin.dollar_value);
                if (valueToAdd > 100 * 1e6) {
                    console.log(transaction.tx_hash, Number((valueToAdd / 1e6).toFixed(0)));
                }
                if (valueToAdd < 50 * 1e9) {
                    if (transaction.transaction_type === TransactionType.Swap && coin.direction === 'out') {
                        // if (valueToAdd > 100000) {
                        //   console.log(transaction.tx_hash, Number((valueToAdd / 1e6).toFixed(3)));
                        // }
                        acc[day] += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Deposit && coin.direction === 'in') {
                        acc[day] += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Remove && coin.direction === 'out') {
                        acc[day] += valueToAdd;
                    }
                }
            }
        });
        return acc;
    }, {});
    return dailyVolumes;
}
export async function calculateDailySandwichVolumes(poolId, startUnixtime, endUnixtime) {
    const dailyVolumes = {};
    const data = await getSandwichContentForPoolAndTime(poolId, startUnixtime, endUnixtime);
    for (const sandwich of data) {
        const frontrunVolume = await getTransactionVolume(sandwich.frontrun.tx_id);
        const backrunVolume = await getTransactionVolume(sandwich.backrun.tx_id);
        const totalVolume = Number(frontrunVolume) + Number(backrunVolume);
        const day = new Date(sandwich.frontrun.block_unixtime * 1000).toISOString().split('T')[0];
        // Ensure the accumulator for the day is initialized as a number
        dailyVolumes[day] = (Number(dailyVolumes[day]) || 0) + totalVolume;
    }
    return dailyVolumes;
}
export async function getTransactionVolume(txId) {
    let volume = 0; // Initialize volume as a number
    const transaction = await Transactions.findByPk(txId, {
        include: [TransactionCoins],
    });
    if (transaction) {
        transaction.transactionCoins.forEach((coin) => {
            if (coin.dollar_value != null) {
                const valueToAdd = Number(coin.dollar_value);
                if (valueToAdd < 50 * 1e9) {
                    if (transaction.transaction_type === TransactionType.Swap && coin.direction === 'out') {
                        volume += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Deposit && coin.direction === 'in') {
                        volume += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Remove && coin.direction === 'out') {
                        volume += valueToAdd;
                    }
                }
            }
        });
    }
    return volume; // Return volume as a number
}
export async function calculateDailyAtomicArbVolumes(poolId, startUnixtime, endUnixtime) {
    const atomicTxIds = await fetchAtomicArbsForPoolAndTime(poolId, startUnixtime, endUnixtime);
    const transactions = await fetchTransactionsWithCoinsByTxIds(atomicTxIds);
    const dailyVolumes = transactions.reduce((acc, transaction) => {
        const day = new Date(transaction.block_unixtime * 1000).toISOString().split('T')[0];
        acc[day] = acc[day] || 0;
        transaction.transactionCoins.forEach((coin) => {
            if (coin.dollar_value != null) {
                const valueToAdd = Number(coin.dollar_value);
                if (valueToAdd < 50 * 1e9) {
                    if (transaction.transaction_type === TransactionType.Swap && coin.direction === 'out') {
                        acc[day] += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Deposit && coin.direction === 'in') {
                        acc[day] += valueToAdd;
                    }
                    else if (transaction.transaction_type === TransactionType.Remove && coin.direction === 'out') {
                        acc[day] += valueToAdd;
                    }
                }
            }
        });
        return acc;
    }, {});
    return dailyVolumes;
}
export async function calculateDailyCexDexArbVolumes(poolId, startUnixtime, endUnixtime) {
    const arbTxIds = await fetchCexDexArbTxIdsForPoolAndTime(poolId, startUnixtime, endUnixtime);
    const transactions = await fetchTransactionsWithCoinsByTxIds(arbTxIds);
    const dailyVolumes = transactions.reduce((acc, transaction) => {
        const day = new Date(transaction.block_unixtime * 1000).toISOString().split('T')[0];
        acc[day] = acc[day] || 0;
        for (const coin of transaction.transactionCoins) {
            if (coin.dollar_value !== null) {
                acc[day] += Number(coin.dollar_value);
                break;
            }
        }
        return acc;
    }, {});
    return dailyVolumes;
}
export async function calculateDailyCexDexArbLowerBoundaryRevenue(poolId, startUnixtime, endUnixtime) {
    const arbTxIds = await fetchCexDexArbTxIdsForPoolAndTime(poolId, startUnixtime, endUnixtime);
    const transactions = await fetchTransactionsWithCoinsByTxIds(arbTxIds);
    let counter = 0;
    const dailyRevenues = await transactions.reduce(async (accPromise, transaction) => {
        const acc = await accPromise;
        const day = new Date(transaction.block_unixtime * 1000).toISOString().split('T')[0];
        acc[day] = acc[day] || 0;
        const revenueLowerBound = await solveRevenueLowerBoundInUSD(transaction.tx_id);
        acc[day] += revenueLowerBound;
        counter++;
        if (counter % 25 === 0) {
            console.log(`Processed ${counter}/${transactions.length}`);
        }
        return acc;
    }, Promise.resolve({}));
    return dailyRevenues;
}
//# sourceMappingURL=Volume.js.map