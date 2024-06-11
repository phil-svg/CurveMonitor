import { convertDateToUnixTime } from '../../helperFunctions/QualityOfLifeStuff.js';
import { getAllPoolIds, getPoolIdByPoolAddress, getPoolsBySourceAddress, } from '../../postgresTables/readFunctions/Pools.js';
import { saveJsonToExcel } from '../utils/Excel.js';
import { calculateDailySandwichVolumes, calculateDailyVolumes, calculateDailyAtomicArbVolumes, calculateDailyCexDexArbVolumes, formatVolumeDataToJson, } from '../utils/Volume.js';
export async function generateVolumeReportForSinglePool(poolAddress, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    if (!poolId) {
        console.log('could not find poolId for', poolAddress, 'in generateVolumeReportForSinglePool');
        return;
    }
    const dailyVolumes = await calculateDailyVolumes(poolId, startUnixTime, endUnixTime);
    const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId, startUnixTime, endUnixTime);
    const dailyAtomicArbVolumes = await calculateDailyAtomicArbVolumes(poolId, startUnixTime, endUnixTime);
    const dailyCexDexArbVolumes = await calculateDailyCexDexArbVolumes(poolId, startUnixTime, endUnixTime);
    const resultJson = formatVolumeDataToJson(dailyVolumes, sandwichDailyVolumes, dailyAtomicArbVolumes, dailyCexDexArbVolumes);
    await saveJsonToExcel(resultJson, 'resultJson.xlsx');
    // const data = JSON.stringify(resultJson, null, 2); // Pretty print with 2 spaces
    // fs.writeFileSync("result.json", data, "utf8");
    console.log('Research step complete!');
}
// Utility function to aggregate volumes across pools
function aggregateVolumes(aggregate, dailyVolumes) {
    Object.entries(dailyVolumes).forEach(([day, volume]) => {
        if (aggregate[day]) {
            aggregate[day] += volume;
        }
        else {
            aggregate[day] = volume;
        }
    });
}
export async function generateVolumeReportForPoolArr(startDate, endDate) {
    const ADDRESS_STABESWAP = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4';
    const ADDRESS_STABESWAP_NG = '0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf';
    const stableswapPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP);
    const stableswapNGPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP_NG);
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    let aggregateDailyVolumes = {};
    let aggregateSandwichDailyVolumes = {};
    let aggregateDailyAtomicArbVolumes = {};
    let aggregateDailyCexDexArbVolumes = {};
    let poolCounter = 0;
    const poolArr = stableswapPoolAddressArr;
    for (const poolAddress of poolArr) {
        poolCounter++;
        console.log(poolCounter, poolArr.length);
        const poolId = await getPoolIdByPoolAddress(poolAddress);
        if (!poolId) {
            console.log(`Could not find poolId for ${poolAddress} in generateVolumeReportForPoolArr`);
            continue;
        }
        // Calculate volumes for the current pool
        const dailyVolumes = await calculateDailyVolumes(poolId, startUnixTime, endUnixTime);
        const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId, startUnixTime, endUnixTime);
        const dailyAtomicArbVolumes = await calculateDailyAtomicArbVolumes(poolId, startUnixTime, endUnixTime);
        const dailyCexDexArbVolumes = await calculateDailyCexDexArbVolumes(poolId, startUnixTime, endUnixTime);
        // Aggregate volumes across pools
        aggregateVolumes(aggregateDailyVolumes, dailyVolumes);
        aggregateVolumes(aggregateSandwichDailyVolumes, sandwichDailyVolumes);
        aggregateVolumes(aggregateDailyAtomicArbVolumes, dailyAtomicArbVolumes);
        aggregateVolumes(aggregateDailyCexDexArbVolumes, dailyCexDexArbVolumes);
    }
    // Format and save aggregated data
    const resultJson = formatVolumeDataToJson(aggregateDailyVolumes, aggregateSandwichDailyVolumes, aggregateDailyAtomicArbVolumes, aggregateDailyCexDexArbVolumes);
    await saveJsonToExcel(resultJson, 'volFetch.xlsx');
    console.log('Volume report generated for all pools.');
}
export async function calculateAndSaveDailyAggregateVolumeReport(startDate, endDate) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    const poolIds = await getAllPoolIds();
    let aggregateDailyVolumes = {};
    let aggregateSandwichVolumes = {};
    let aggregateAtomicArbVolumes = {};
    let aggregateCexDexArbVolumes = {};
    let counter = 0;
    for (const poolId of poolIds) {
        counter++;
        console.log('Processing Pools:', counter, poolIds.length);
        const dailyVolumes = await calculateDailyVolumes(poolId, startUnixtime, endUnixtime);
        const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId, startUnixtime, endUnixtime);
        const dailyAtomicArbVolumes = await calculateDailyAtomicArbVolumes(poolId, startUnixtime, endUnixtime);
        const dailyCexDexArbVolumes = await calculateDailyCexDexArbVolumes(poolId, startUnixtime, endUnixtime);
        aggregateDailyVolumes = sumUpVolumes(aggregateDailyVolumes, dailyVolumes);
        aggregateSandwichVolumes = sumUpVolumes(aggregateSandwichVolumes, sandwichDailyVolumes);
        aggregateAtomicArbVolumes = sumUpVolumes(aggregateAtomicArbVolumes, dailyAtomicArbVolumes);
        aggregateCexDexArbVolumes = sumUpVolumes(aggregateCexDexArbVolumes, dailyCexDexArbVolumes);
    }
    const resultJson = formatVolumeDataToJson(aggregateDailyVolumes, aggregateSandwichVolumes, aggregateAtomicArbVolumes, aggregateCexDexArbVolumes);
    await saveJsonToExcel(resultJson, 'resultJson.xlsx');
    console.log('done');
}
function sumUpVolumes(aggregate, newVolumes) {
    const result = Object.assign({}, aggregate);
    for (const [date, volume] of Object.entries(newVolumes)) {
        if (result[date]) {
            result[date] += volume;
        }
        else {
            result[date] = volume;
        }
    }
    return result;
}
function aggregateToWeeklyVolumes(dailyVolumes) {
    const weeklyVolumes = {};
    for (const [date, volume] of Object.entries(dailyVolumes)) {
        const weekNumber = getWeekNumber(new Date(date));
        weeklyVolumes[weekNumber] = (weeklyVolumes[weekNumber] || 0) + volume;
    }
    return weeklyVolumes;
}
// Utility function to get the week number
function getWeekNumber(d) {
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    return `W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
}
// Modified function to calculate and save aggregate weekly volume report
export async function calculateAndSaveAggregateWeeklyVolumeReport(startUnixtime, endUnixtime) {
    const poolIds = await getAllPoolIds();
    let aggregateWeeklyVolumes = {};
    let aggregateWeeklySandwichVolumes = {};
    let aggregateWeeklyAtomicArbVolumes = {};
    let aggregateWeeklyCexDexArbVolumes = {};
    let counter = 0;
    for (const poolId of poolIds) {
        counter++;
        console.log(counter, poolIds.length);
        const dailyVolumes = await calculateDailyVolumes(poolId, startUnixtime, endUnixtime);
        const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId, startUnixtime, endUnixtime);
        const dailyAtomicArbVolumes = await calculateDailyAtomicArbVolumes(poolId, startUnixtime, endUnixtime);
        const dailyCexDexArbVolumes = await calculateDailyCexDexArbVolumes(poolId, startUnixtime, endUnixtime);
        const weeklyVolumes = aggregateToWeeklyVolumes(dailyVolumes);
        const weeklySandwichVolumes = aggregateToWeeklyVolumes(sandwichDailyVolumes);
        const weeklyAtomicArbVolumes = aggregateToWeeklyVolumes(dailyAtomicArbVolumes);
        const weeklyCexDexArbVolumes = aggregateToWeeklyVolumes(dailyCexDexArbVolumes);
        aggregateWeeklyVolumes = sumUpVolumes(aggregateWeeklyVolumes, weeklyVolumes);
        aggregateWeeklySandwichVolumes = sumUpVolumes(aggregateWeeklySandwichVolumes, weeklySandwichVolumes);
        aggregateWeeklyAtomicArbVolumes = sumUpVolumes(aggregateWeeklyAtomicArbVolumes, weeklyAtomicArbVolumes);
        aggregateWeeklyCexDexArbVolumes = sumUpVolumes(aggregateWeeklyCexDexArbVolumes, weeklyCexDexArbVolumes);
    }
    const resultJson = formatVolumeDataToJson(aggregateWeeklyVolumes, aggregateWeeklySandwichVolumes, aggregateWeeklyAtomicArbVolumes, aggregateWeeklyCexDexArbVolumes);
    const sortedSummary = sortWeeklyData(resultJson);
    // Convert the sorted array back to the required format for saveJsonToExcel
    const reformattedData = {};
    sortedSummary.forEach(([week, data]) => {
        reformattedData[week] = data;
    });
    await saveJsonToExcel(reformattedData, 'resultJsonWeekly.xlsx');
    console.log('Weekly aggregate report generated.');
}
function sortWeeklyData(data) {
    return Object.entries(data).sort((a, b) => {
        return a[0].localeCompare(b[0]);
    });
}
//# sourceMappingURL=VolFetch.js.map