import { Sequelize } from "sequelize";
import { TransactionCoins } from "../../models/TransactionCoins.js";
import { countEntriesWithNullDollarValue, findSwapTransactionsForTwoCoins, findSwapsForCoin, findTransactionIdsForCoinWithNullDollarValue, getPriceArrayFromSwapEntries, getTotalEntries, } from "../postgresTables/readFunctions/TransactionCoins.js";
import { getTransactionUnixtimes } from "../postgresTables/readFunctions/Transactions.js";
export async function findExtrapolatedPrice(priceArray, targetUnixtime) {
    // Sort the array in ascending order by unixtime
    priceArray.sort((a, b) => a.unixtime - b.unixtime);
    let before = null;
    let after = null;
    // iterate through the priceArray to find the closest two unixtimes-price pairs
    for (const entry of priceArray) {
        if (entry.unixtime < targetUnixtime) {
            before = entry;
        }
        else if (entry.unixtime >= targetUnixtime) {
            after = entry;
            break;
        }
    }
    // if there are no entries before or after the targetUnixtime, return the price of the closest entry
    if (before === null && after === null) {
        throw new Error("priceArray is empty");
    }
    else if (before === null) {
        return after ? after.price : 0;
    }
    else if (after === null) {
        return before.price;
    }
    // interpolate the price at targetUnixtime using the before and after entries
    const timeWeight = (targetUnixtime - before.unixtime) / (after.unixtime - before.unixtime);
    return before.price + timeWeight * (after.price - before.price);
}
export async function updateMostStableDollarCoinPrices(coin_id) {
    try {
        await TransactionCoins.update({ dollar_value: Sequelize.col("amount") }, {
            where: {
                coin_id: coin_id,
                dollar_value: null,
            },
        });
    }
    catch (error) {
        console.error("Error updating dollar value with amount:", error);
        throw error;
    }
}
export async function updateDollarValue(tx_id, coin_id, dollar_value) {
    const existingTransaction = await TransactionCoins.findOne({
        where: {
            tx_id: tx_id,
            coin_id: coin_id,
        },
    });
    if (existingTransaction) {
        if (existingTransaction.dollar_value !== null) {
            console.log(`Dollar value already exists for transaction ID: ${tx_id} and coin ID: ${coin_id}.`);
        }
        else {
            await TransactionCoins.update({ dollar_value: dollar_value }, {
                where: {
                    tx_id: tx_id,
                    coin_id: coin_id,
                },
            });
        }
    }
    else {
        console.log(`Transaction with ID: ${tx_id} and coin ID: ${coin_id} does not exist.`);
    }
}
export async function missingCounterUpdate() {
    let entriesWithNullDollarValue = await countEntriesWithNullDollarValue();
    let totalEntries = await getTotalEntries();
    console.log(`There are ${entriesWithNullDollarValue} of ${totalEntries} entries missing pricing.`);
}
export async function extrapolateMultiple(coinIds) {
    for (const COIN_ID of coinIds) {
        await extrapolate(COIN_ID);
    }
}
export async function extrapolate(coinId) {
    const TX_IDS = await findTransactionIdsForCoinWithNullDollarValue(coinId);
    const TX_WITH_UNIXTIMES = await getTransactionUnixtimes(TX_IDS);
    const priceArrayFromSwapEntries = await getPriceArrayFromSwapEntries(coinId);
    // iterate over TX_WITH_UNIXTIMES array
    for (let i = 0; i < TX_WITH_UNIXTIMES.length; i++) {
        const { tx_id, block_unixtime } = TX_WITH_UNIXTIMES[i];
        // get extrapolated price for current unixtime
        const price = await findExtrapolatedPrice(priceArrayFromSwapEntries, block_unixtime);
        // update dollar value
        await updateDollarValue(tx_id, coinId, price);
    }
}
export async function getCoinIdsAboveThreshold(pricedCoinId, newSwapCounterPartCoinIds) {
    let coinIdsAboveThreshold = [];
    for (const coinId of newSwapCounterPartCoinIds) {
        const swapForCoins = await findSwapsForCoin(coinId);
        const swapTransactionsForTwoCoins = await findSwapTransactionsForTwoCoins(pricedCoinId, coinId);
        const percentageOfSwapCoverage = 100 * (swapTransactionsForTwoCoins.length / swapForCoins.length);
        if (percentageOfSwapCoverage >= 20) {
            coinIdsAboveThreshold.push(coinId);
        }
    }
    return coinIdsAboveThreshold;
}
//# sourceMappingURL=Prices.js.map