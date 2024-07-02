import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { getCreationTimestampBy, getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';
import { getTimeframeTimestamp } from '../utils/Timeframes.js';
import { createIntervalBlueprint, determineSqlInterval, mergeData, secondsPerUnit, } from './Helper.js';
export async function getTransactionHashesForFull(poolId, timeframeStartUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    const query = `
  SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime)) AS interval_start,
    ARRAY_AGG(DISTINCT t.tx_hash) AS transaction_hashes
  FROM transactions t
  WHERE t.pool_id = :poolId
    AND t.block_unixtime >= :timeframeStartUnix
    AND t.value_usd IS NOT NULL
  GROUP BY interval_start
  ORDER BY interval_start;
`;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
        },
    });
    return data;
}
export async function getTransactionCountsForFull(poolId, timeframeStartUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    const query = `
  SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime)) AS interval_start,
    COUNT(DISTINCT t.tx_id) AS transaction_count
  FROM transactions t
  WHERE t.pool_id = :poolId
    AND t.block_unixtime >= :timeframeStartUnix
    AND t.value_usd IS NOT NULL
  GROUP BY interval_start
  ORDER BY interval_start;
`;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
        },
    });
    return data;
}
export async function getTransactionHashesForAtomicArbs(poolId, startUnixtime, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    const query = `
    SELECT 
      DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime)) AS interval_start,
      ARRAY_AGG(DISTINCT t.tx_hash) AS transaction_hashes
    FROM transactions t
    JOIN atomic_arbs a ON t.tx_id = a.tx_id
    WHERE t.pool_id = :poolId
      AND t.block_unixtime >= :startUnixtime
      AND t.value_usd IS NOT NULL
      AND a.is_atomic_arb = TRUE
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            startUnixtime,
        },
    });
    return data;
}
export async function getTransactionCountsForAtomicArbs(poolId, startUnixtime, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    const query = `
    SELECT 
      DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime)) AS interval_start,
      COUNT(DISTINCT t.tx_id) AS transaction_count
    FROM transactions t
    JOIN atomic_arbs a ON t.tx_id = a.tx_id
    WHERE t.pool_id = :poolId
      AND t.block_unixtime >= :startUnixtime
      AND t.value_usd IS NOT NULL
      AND a.is_atomic_arb = TRUE
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            startUnixtime,
        },
    });
    return data;
}
export async function getPoolSpecificFullVolumeData(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    // const fetchIntervalNum = Number(interval.split(' ')[0]);
    const query = `
  SELECT 
      DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC') AS interval_start,
      CAST(EXTRACT(EPOCH FROM DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC')) AS INTEGER) AS interval_start_unixtime,
      CAST(ROUND(COALESCE(SUM(t.value_usd), 0)) AS INTEGER) AS total_volume
  FROM transactions t
  WHERE t.pool_id = :poolId
      AND t.block_unixtime >= :timeframeStartUnix
      AND t.value_usd IS NOT NULL
  GROUP BY interval_start
  ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    // console.log('sql data:', data);
    const blueprint = createIntervalBlueprint(timeframeStartUnix, timeframeEndUnix, interval);
    // console.log('blueprint', blueprint);
    const mergedData = mergeData(blueprint, data);
    // console.log('mergedData', mergedData);
    return mergedData;
}
export async function getPoolSpecificAtomicArbsVolume(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    // const fetchIntervalNum = Number(interval.split(' ')[0]);
    const query = `
    SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC') AS interval_start,
    CAST(EXTRACT(EPOCH FROM DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC')) AS INTEGER) AS interval_start_unixtime,
    CAST(ROUND(COALESCE(SUM(t.value_usd), 0)) AS INTEGER) AS total_volume
    FROM transactions t
    JOIN atomic_arbs a ON t.tx_id = a.tx_id
    WHERE t.pool_id = :poolId
      AND t.block_unixtime >= :timeframeStartUnix
      AND t.value_usd IS NOT NULL
      AND a.is_atomic_arb = TRUE
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    // console.log('sql data:', data);
    const blueprint = createIntervalBlueprint(timeframeStartUnix, timeframeEndUnix, interval);
    // console.log('blueprint', blueprint);
    const mergedData = mergeData(blueprint, data);
    // console.log('mergedData', mergedData);
    return mergedData;
}
async function getPoolSpecificCexDexArbVolume(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    // const fetchIntervalNum = Number(interval.split(' ')[0]);
    const query = `
    SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC') AS interval_start,
    CAST(EXTRACT(EPOCH FROM DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC')) AS INTEGER) AS interval_start_unixtime,
    CAST(ROUND(COALESCE(SUM(t.value_usd), 0)) AS INTEGER) AS total_volume
    FROM transactions t
    JOIN is_cex_dex_arb a ON t.tx_id = a.tx_id
    WHERE t.pool_id = :poolId
      AND t.block_unixtime >= :timeframeStartUnix
      AND t.value_usd IS NOT NULL
      AND a.is_cex_dex_arb = TRUE
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    // console.log('sql data:', data);
    const blueprint = createIntervalBlueprint(timeframeStartUnix, timeframeEndUnix, interval);
    // console.log('blueprint', blueprint);
    const mergedData = mergeData(blueprint, data);
    // console.log('mergedData', mergedData);
    return mergedData;
}
async function findPoolSpecificFrontAndBackrunTxIdsForDuration_LossWithin(poolId, timeframeStartUnix, timeframeEndUnix) {
    const query = `
    SELECT s.frontrun, s.backrun
    FROM sandwiches s
    JOIN transactions t ON (t.tx_id = s.frontrun OR t.tx_id = s.backrun)
    WHERE t.pool_id = :poolId
      AND t.block_unixtime BETWEEN :timeframeStartUnix AND :timeframeEndUnix
      AND s.extracted_from_curve = true
  `;
    const transactions = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    const uniqueTransactionIds = new Set();
    transactions.forEach(({ frontrun, backrun }) => {
        uniqueTransactionIds.add(frontrun);
        uniqueTransactionIds.add(backrun);
    });
    return Array.from(uniqueTransactionIds);
}
async function findPoolSpecificFrontAndBackrunTxIdsForDuration_LossOutside(poolId, timeframeStartUnix, timeframeEndUnix) {
    const query = `
    SELECT s.frontrun, s.backrun
    FROM sandwiches s
    JOIN transactions t ON (t.tx_id = s.frontrun OR t.tx_id = s.backrun)
    WHERE t.pool_id = :poolId
      AND t.block_unixtime BETWEEN :timeframeStartUnix AND :timeframeEndUnix
      AND s.extracted_from_curve = false
  `;
    const transactions = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    const uniqueTransactionIds = new Set();
    transactions.forEach(({ frontrun, backrun }) => {
        uniqueTransactionIds.add(frontrun);
        uniqueTransactionIds.add(backrun);
    });
    return Array.from(uniqueTransactionIds);
}
async function getPoolSpecificSandwichVolume_LossWithin(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    // const fetchIntervalNum = Number(interval.split(' ')[0]);
    const sandwichTxIdsByBot = await findPoolSpecificFrontAndBackrunTxIdsForDuration_LossWithin(poolId, timeframeStartUnix, timeframeEndUnix);
    if (sandwichTxIdsByBot.length === 0)
        return [];
    const txIdsString = sandwichTxIdsByBot.join(', ');
    const query = `
    SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC') AS interval_start,
    CAST(EXTRACT(EPOCH FROM DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC')) AS INTEGER) AS interval_start_unixtime,
    CAST(ROUND(COALESCE(SUM(t.value_usd), 0)) AS INTEGER) AS total_volume
    FROM transactions t
    WHERE t.tx_id IN (${txIdsString})
      AND t.block_unixtime >= :timeframeStartUnix
      AND t.value_usd IS NOT NULL
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    // console.log('sql data:', data);
    const blueprint = createIntervalBlueprint(timeframeStartUnix, timeframeEndUnix, interval);
    // console.log('blueprint', blueprint);
    const mergedData = mergeData(blueprint, data);
    // console.log('mergedData', mergedData);
    return mergedData;
}
async function getPoolSpecificSandwichVolume_LossOutside(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const fetchInterval = interval.split(' ')[1];
    // const fetchIntervalNum = Number(interval.split(' ')[0]);
    const sandwichTxIdsByBot = await findPoolSpecificFrontAndBackrunTxIdsForDuration_LossOutside(poolId, timeframeStartUnix, timeframeEndUnix);
    if (sandwichTxIdsByBot.length === 0)
        return [];
    const txIdsString = sandwichTxIdsByBot.join(', ');
    const query = `
    SELECT 
    DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC') AS interval_start,
    CAST(EXTRACT(EPOCH FROM DATE_TRUNC('${fetchInterval}', TO_TIMESTAMP(t.block_unixtime) AT TIME ZONE 'UTC')) AS INTEGER) AS interval_start_unixtime,
    CAST(ROUND(COALESCE(SUM(t.value_usd), 0)) AS INTEGER) AS total_volume
    FROM transactions t
    WHERE t.tx_id IN (${txIdsString})
      AND t.block_unixtime >= :timeframeStartUnix
      AND t.value_usd IS NOT NULL
    GROUP BY interval_start
    ORDER BY interval_start;
  `;
    const data = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
            poolId,
            timeframeStartUnix,
            timeframeEndUnix,
        },
    });
    // console.log('sql data:', data);
    const blueprint = createIntervalBlueprint(timeframeStartUnix, timeframeEndUnix, interval);
    // console.log('blueprint', blueprint);
    const mergedData = mergeData(blueprint, data);
    // console.log('mergedData', mergedData);
    return mergedData;
}
function determineNumberOfDataPoints(timeframeStartUnix, timeframeEndUnix, timeInterval) {
    const interval = determineSqlInterval(timeInterval);
    const secondsPerInterval = secondsPerUnit(interval.split(' ')[1]) * parseInt(interval.split(' ')[0]);
    return Math.floor((timeframeEndUnix - timeframeStartUnix) / secondsPerInterval);
}
function aggregateVolumes(dataArrays) {
    const aggregatedMap = new Map();
    dataArrays.forEach(({ data, category }) => {
        data.forEach((item) => {
            let aggregate = aggregatedMap.get(item.interval_start_unixtime);
            if (!aggregate) {
                aggregate = {
                    interval_start: new Date(item.interval_start),
                    interval_start_unixtime: item.interval_start_unixtime,
                    full_volume: 0,
                    atomicArbVolume: 0,
                    cexDexArbVolume: 0,
                    sandwichVolume_LossWithin: 0,
                    sandwichVolume_LossOutside: 0,
                };
                aggregatedMap.set(item.interval_start_unixtime, aggregate);
            }
            if (typeof aggregate[category] === 'number') {
                aggregate[category] += item.total_volume;
            }
        });
    });
    return Array.from(aggregatedMap.values()).sort((a, b) => a.interval_start_unixtime - b.interval_start_unixtime);
}
export async function getPoolSpecificAggregatedMevVolume(poolAddress, timeDuration, timeInterval, startUnixtimeViaInput, endUnixtimeViaInput) {
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    if (!poolId) {
        throw new Error(`Pool ID not found for address: ${poolAddress}`);
    }
    let timeframeStartUnix;
    if (startUnixtimeViaInput) {
        timeframeStartUnix = startUnixtimeViaInput;
    }
    else if (timeDuration === 'full') {
        timeframeStartUnix = await getCreationTimestampBy({ id: poolId });
        if (!timeframeStartUnix) {
            throw new Error(`Creation timestamp not found for pool ID: ${poolId}`);
        }
    }
    else {
        timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    }
    let timeframeEndUnix;
    if (endUnixtimeViaInput) {
        timeframeEndUnix = endUnixtimeViaInput;
    }
    else {
        timeframeEndUnix = Math.floor(Date.now() / 1000);
    }
    const dataPoints = determineNumberOfDataPoints(timeframeStartUnix, timeframeEndUnix, timeInterval);
    if (dataPoints > 10000) {
        let info = 'too many data points, please choose a smaller interval or timeframe. Overshot allowance by ' +
            Number(dataPoints - 10000).toFixed(0) +
            ' data points';
        console.log(info);
        // return info;
        return [];
    }
    else {
        console.log('requested fetch of', dataPoints, 'data points');
    }
    console.log('Received Request with timeframe', timeDuration, 'and interval', timeInterval);
    console.time('Full Volume Calculation');
    const fullVolumeData = await getPoolSpecificFullVolumeData(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval);
    console.timeEnd('Full Volume Calculation');
    // console.log("fullVolumeData", fullVolumeData);
    console.time('Atomic Arbitrage Volume Calculation');
    const atomicArbVolume = await getPoolSpecificAtomicArbsVolume(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval);
    console.timeEnd('Atomic Arbitrage Volume Calculation');
    // console.log("atomicArbVolume", atomicArbVolume);
    console.time('Cex Dex Arbitrage Volume Calculation');
    const cexDexArbVolume = await getPoolSpecificCexDexArbVolume(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval);
    console.timeEnd('Cex Dex Arbitrage Volume Calculation');
    // console.log("cexDexArbVolume", cexDexArbVolume);
    console.time('Sandwich Volume Calculation (Loss Within)');
    const sandwichVolume_LossWithin = await getPoolSpecificSandwichVolume_LossWithin(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval);
    console.timeEnd('Sandwich Volume Calculation (Loss Within)');
    // console.log("sandwichVolume_LossWithin", sandwichVolume_LossWithin);
    console.time('Sandwich Volume Calculation (Loss Outside)');
    const sandwichVolume_LossOutside = await getPoolSpecificSandwichVolume_LossOutside(poolId, timeframeStartUnix, timeframeEndUnix, timeInterval);
    console.timeEnd('Sandwich Volume Calculation (Loss Outside)');
    // console.log("sandwichVolume_LossOutside", sandwichVolume_LossOutside);
    const aggregatedData = aggregateVolumes([
        { data: fullVolumeData, category: 'full_volume' },
        { data: atomicArbVolume, category: 'atomicArbVolume' },
        { data: cexDexArbVolume, category: 'cexDexArbVolume' },
        { data: sandwichVolume_LossWithin, category: 'sandwichVolume_LossWithin' },
        { data: sandwichVolume_LossOutside, category: 'sandwichVolume_LossOutside' },
    ]);
    return aggregatedData.slice(1);
}
//# sourceMappingURL=AggregatedMevVolume.js.map