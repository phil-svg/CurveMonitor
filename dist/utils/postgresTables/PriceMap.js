import { Op, Sequelize } from 'sequelize';
import { TransactionCoins } from '../../models/TransactionCoins.js';
import { FirstPriceTimestamp } from '../../models/FirstTokenPrices.js';
import { getFirstTokenPriceData, getTokenPriceChartData } from '../TokenPrices/txValue/DefiLlama.js';
import { findCoinAddressById } from './readFunctions/Coins.js';
import { dbInceptionBlock } from './RawLogs.js';
import { PriceMap } from '../../models/PriceMap.js';
import { getLatestStoredPriceTimestampForCoin } from './readFunctions/PriceMap.js';
// finds all coins which have been transacted in curve pools.
async function getUniqueCoinIds() {
    const uniqueCoinIds = await TransactionCoins.findAll({
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('coin_id')), 'coin_id']],
        raw: true,
    });
    return uniqueCoinIds.map((u) => u.coin_id);
}
// filters out unpriced coinIds
async function filterCoinIds(coinIds) {
    const validCoinIds = [];
    for (const coinId of coinIds) {
        const priceTimestamp = await FirstPriceTimestamp.findOne({
            where: { coin_id: coinId },
            raw: true,
        });
        // If it doesn't exist or has a timestamp of 420, we don't consider it valid for processing
        if (priceTimestamp && priceTimestamp.firstTimestampDefillama !== 420) {
            validCoinIds.push(coinId);
        }
    }
    return validCoinIds;
}
// Function to fetch and store earliest price data
async function fetchAndStoreEarliestPriceTimestamp() {
    try {
        // Step 1: Get all unique coin_ids from TransactionCoins
        const uniqueCoinIds = await getUniqueCoinIds();
        // Step 2 & 3: Check for each coin_id and fetch the data if not already stored
        for (const coin_id of uniqueCoinIds) {
            const isFirstPriceStored = await FirstPriceTimestamp.findOne({
                where: { coin_id },
            });
            if (!isFirstPriceStored) {
                // Step 3: Fetch the earliest price from DeFiLlama
                const tokenAddress = await findCoinAddressById(coin_id);
                const firstPriceData = await getFirstTokenPriceData(tokenAddress);
                if (firstPriceData) {
                    // Step 4: Store the fetched price data in FirstPriceTimestamp
                    await FirstPriceTimestamp.create({
                        coin_id,
                        firstTimestampDefillama: firstPriceData.timestamp, // Convert Unix timestamp to JavaScript Date object
                    });
                }
                else {
                    await FirstPriceTimestamp.create({
                        coin_id,
                        firstTimestampDefillama: 420, // mock timestamp, signaling unpriced by defillama
                    });
                }
            }
        }
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
}
async function determineStartTime(firstPriceEntry) {
    const currentUnixTime = Math.floor(Date.now() / 1000);
    let startTime = dbInceptionBlock;
    if (firstPriceEntry &&
        firstPriceEntry.firstTimestampDefillama &&
        firstPriceEntry.firstTimestampDefillama > dbInceptionBlock) {
        startTime = firstPriceEntry.firstTimestampDefillama;
    }
    const daysSinceStart = Math.floor((currentUnixTime - startTime) / (24 * 60 * 60));
    return { start: startTime, span: daysSinceStart };
}
async function handlePriceChartResponse(tokenAddress, coinId, priceChartResponse, latestTimestamp) {
    if (priceChartResponse === 'missing') {
        console.log('priceChartFromDefiLlama missing for', tokenAddress);
        await FirstPriceTimestamp.update({ firstTimestampDefillama: 420 }, { where: { coin_id: coinId } });
        return;
    }
    // Store the new price data points into the database
    if (!priceChartResponse || !priceChartResponse.prices)
        return;
    for (const priceData of priceChartResponse.prices) {
        // Only store if the data point is new
        if (!latestTimestamp || priceData.timestamp > latestTimestamp) {
            await PriceMap.create({
                coin_id: coinId,
                coinPriceUsd: priceData.price,
                priceTimestamp: priceData.timestamp,
            });
        }
    }
}
export async function processSingleCoinForPriceChart(coinId) {
    try {
        const tokenAddress = await findCoinAddressById(coinId);
        const firstPriceEntry = await FirstPriceTimestamp.findOne({
            where: { coin_id: coinId },
            attributes: ['firstTimestampDefillama'],
            raw: true,
        });
        if (!firstPriceEntry) {
            console.log('firstPriceEntry not found for coinId', coinId);
            return;
        }
        let { start, span } = await determineStartTime(firstPriceEntry);
        // Find the latest timestamp we have stored in the database
        const latestTimestamp = await getLatestStoredPriceTimestampForCoin(coinId);
        // If we have a latest timestamp, start fetching from the next day after the latest timestamp
        // Otherwise, use the default start and span
        const newStart = latestTimestamp ? latestTimestamp + 24 * 60 * 60 : start;
        // If there is no latest timestamp, we use the default span.
        // If there is, we calculate a new span from the latest timestamp to now.
        const currentUnixTime = Math.floor(Date.now() / 1000);
        span = latestTimestamp ? Math.floor((currentUnixTime - newStart) / (24 * 60 * 60)) : span;
        const period = '1d';
        const searchWidth = 600;
        // Only fetch if we have a span of at least one day
        if (span > 0) {
            const priceChartFromDefiLlama = await getTokenPriceChartData(tokenAddress, newStart, span, period, searchWidth);
            await handlePriceChartResponse(tokenAddress, coinId, priceChartFromDefiLlama, latestTimestamp);
        }
    }
    catch (error) {
        console.error(`An error occurred while processing coin ID ${coinId}:`, error);
    }
}
async function logTransactionCoinsStats() {
    try {
        const totalEntries = await TransactionCoins.count();
        const totalPricedEntries = await TransactionCoins.count({
            where: { dollar_value: { [Op.not]: null } },
        });
        console.log(`Priced entries: ${totalPricedEntries} of ${totalEntries} (${((totalPricedEntries / totalEntries) * 100).toFixed(2)}%)`);
    }
    catch (error) {
        console.error('Error calculating stats:', error);
    }
}
export async function fetchAndStorePriceCharts() {
    try {
        const uniqueCoinIds = await getUniqueCoinIds();
        const coinIdsToProcess = await filterCoinIds(uniqueCoinIds);
        let counter = 0;
        for (const coinId of coinIdsToProcess) {
            counter++;
            if (counter % 100 === 0 && coinIdsToProcess.length > 201)
                console.log('Fetching Price Charts', counter, coinIdsToProcess.length);
            await processSingleCoinForPriceChart(coinId);
        }
        // console.log('[✓] Price charts fetched and stored successfully.');
    }
    catch (error) {
        console.error('An error occurred while fetching price charts:', error);
    }
}
export async function updatePriceMap() {
    await fetchAndStoreEarliestPriceTimestamp();
    await fetchAndStorePriceCharts();
    // await logTransactionCoinsStats();
    // console.log(`[✓] Price Map updated successfully.`);
}
//# sourceMappingURL=PriceMap.js.map