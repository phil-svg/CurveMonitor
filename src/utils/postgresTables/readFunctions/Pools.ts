import { Op, QueryTypes } from 'sequelize';
import { Pool } from '../../../models/Pools.js';
import { findCoinAddressById, findCoinAddressesByIds } from './Coins.js';
import { getLatestTransactionTimeForAllPools } from './Transactions.js';
import { toChecksumAddress } from '../../helperFunctions/Web3.js';
import { sequelize } from '../../../config/Database.js';

export const getPoolIdByPoolAddress = async (poolAddress: string): Promise<number | null> => {
  try {
    const checksumAddress = toChecksumAddress(poolAddress);
    const pool = await Pool.findOne({
      where: {
        address: checksumAddress,
      },
    });

    return pool ? pool.id : null;
  } catch (error) {
    console.error('Error fetching pool ID by address: ', error);
    return null;
  }
};

interface PoolResult {
  id: number;
}

export const getIdByAddressCaseInsensitive = async (poolAddress: string): Promise<number | null> => {
  const checksumAddress = toChecksumAddress(poolAddress);

  const query = `
    SELECT id
    FROM pools
    WHERE address = :checksumAddress
    LIMIT 1;
  `;

  try {
    const result: PoolResult[] = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      raw: true,
      replacements: { checksumAddress },
    });

    if (result.length === 0) {
      const caseInsensitiveQuery = `
        SELECT id
        FROM pools
        WHERE lower(address) = lower(:poolAddress)
        LIMIT 1;
      `;

      const caseInsensitiveResult: PoolResult[] = await sequelize.query(caseInsensitiveQuery, {
        type: QueryTypes.SELECT,
        raw: true,
        replacements: { poolAddress },
      });

      return caseInsensitiveResult.length > 0 ? caseInsensitiveResult[0].id : null;
    }

    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error retrieving pool ID:', error);
    return null;
  }
};

export const getPoolBy = async (options: { id?: number; address?: string }): Promise<Pool | null> => {
  if (options.id) {
    return await Pool.findByPk(options.id);
  } else if (options.address) {
    return await Pool.findOne({
      where: {
        address: {
          [Op.iLike]: options.address,
        },
      },
    });
  } else {
    throw new Error('You must provide either id or address');
  }
};

export const getAllPoolIds = async (): Promise<number[]> => {
  const pools = await Pool.findAll();
  const poolIds = pools.map((pool) => pool.id);
  return poolIds;
};

export const getAllPoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll();
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getAddressById = async (id: number): Promise<string | null> => {
  const pool = await Pool.findByPk(id);
  return pool?.address ?? null;
};

export const getV1PoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll({ where: { version: 'v1' } });
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getV2PoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll({ where: { version: 'v2' } });
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getNameBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.name ?? null;
};

export const getNCoinsBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.n_coins ?? null;
};

export const getCoinsBy = async (options: { id?: number; address?: string }): Promise<string[] | null> => {
  const pool = await getPoolBy(options);
  return pool?.coins ?? null;
};

export const getCoinsInBatchesByPools = async (poolIds: number[]): Promise<{ [poolId: number]: string[] | null }> => {
  const poolCoins: { [poolId: number]: string[] | null } = {};
  for (const poolId of poolIds) {
    const pool = await getPoolBy({ id: poolId });
    if (pool?.coins) {
      poolCoins[poolId] = pool.coins;
    }
  }
  return poolCoins;
};

export const getLpTokenBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.lp_token ?? null;
};

export const getVersionBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.version ?? null;
};

export const getBasePoolBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.base_pool ?? null;
};

export const getSourceAddressBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.source_address ?? null;
};

export const getInceptionBlockBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.inception_block ?? null;
};

export const getCreationTimestampBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.creation_timestamp ?? null;
};

export async function getPoolsByCoinAddress(coinAddress: string): Promise<number[]> {
  const pools = await Pool.findAll({
    where: {
      coins: {
        [Op.contains]: [coinAddress],
      },
    },
  });

  return pools.map((pool) => pool.id);
}

export async function getEarliestPoolInceptionByCoinId(coinId: number): Promise<number | null> {
  const ALL_POOL_IDS = await getAllPoolIds();

  const coinAddress = await findCoinAddressesByIds([coinId]);

  if (!coinAddress) {
    console.log(`No address found for coin ID: ${coinId}`);
    return null;
  }

  const coinAddressStr = coinAddress[0];

  const poolCoins = await getCoinsInBatchesByPools(ALL_POOL_IDS);

  const relevantPoolIds = Object.entries(poolCoins)
    .filter(([_, coinAddresses]) => coinAddresses?.includes(coinAddressStr))
    .map(([poolId, _]) => Number(poolId));

  const poolTimestamps = await Promise.all(relevantPoolIds.map((poolId) => getCreationTimestampBy({ id: poolId })));

  const validPoolTimestamps = poolTimestamps.filter((timestamp): timestamp is number => timestamp !== null);

  if (validPoolTimestamps.length === 0) {
    console.log(`No valid timestamps found for Coin ID ${coinId}`);
    return null;
  }

  const minTimestamp = Math.min(...validPoolTimestamps);

  return minTimestamp;
}

export async function getCoinPositionInPoolByCoinAddress(poolId: number, coinAddress: string): Promise<number | null> {
  try {
    const pool = await Pool.findOne({
      where: {
        id: poolId,
      },
    });

    if (pool && pool.coins) {
      return pool.coins.map((coin) => coin.toLowerCase()).indexOf(coinAddress.toLowerCase());
    }

    return null;
  } catch (error) {
    console.error('Error getting coin position in pool:', error);
    throw error;
  }
}

export async function getCoinPositionInPoolByCoinId(poolId: number, COIN_ID: number): Promise<number | null> {
  const COIN_ADDRESS = await findCoinAddressById(COIN_ID);
  return await getCoinPositionInPoolByCoinAddress(poolId, COIN_ADDRESS!);
}

/**
 * Returns all pool IDs which are older than 180 days based on creation_timestamp.
 * @returns {Promise<number[]>} - Array of pool IDs.
 */
export async function getPoolIdsOlderThan180Days(numberOfDays: number): Promise<number[]> {
  const oneHundredEightyDaysAgo = Math.floor(Date.now() / 1000) - numberOfDays * 24 * 60 * 60; // numberOfDays days in seconds

  const olderPools = await Pool.findAll({
    where: {
      creation_timestamp: {
        [Op.lte]: oneHundredEightyDaysAgo, // Sequelize Op.lte for "less than or equal to"
      },
    },
    attributes: ['id'],
  });

  return olderPools.map((pool) => pool.id);
}

/**
 * Filters out pool IDs that are older than <numberOfDays> days and have not had a transaction in the latest transaction times array.
 *
 * @returns {number[]} - Array of relevant pool IDs for fast mode.
 */
export async function getRelevantPoolIdsForFastModeOld(): Promise<number[]> {
  const numberOfDays = 360;
  const allPoolIdsOlderThan180Days = await getPoolIdsOlderThan180Days(numberOfDays);
  const allPoolIds = await getAllPoolIds();

  const latestTransactionTimeForAllPools = await getLatestTransactionTimeForAllPools();
  const poolIdsWithRecentTransactions = new Set(latestTransactionTimeForAllPools.map((item) => item.pool_id));
  const poolIdsOlderThan180DaysSet = new Set(allPoolIdsOlderThan180Days);

  // Filter out pool IDs
  const relevantPoolIds = allPoolIds.filter(
    (poolId) =>
      !poolIdsOlderThan180DaysSet.has(poolId) || // Keep pools younger than <numberOfDays> days
      poolIdsWithRecentTransactions.has(poolId) // Keep older pools only if they had recent transactions
  );

  return relevantPoolIds;
}

//  pool gets added if young, or had seen activity in recent times
export async function getRelevantPoolIdsForFastMode(): Promise<number[]> {
  const DAYS_FOR_RECENT_ACTIVITY = 2;
  const DAYS_FOR_POOL_AGE = 5;

  const allPoolIds = await getAllPoolIds();
  const latestTransactionTimeForAllPools = await getLatestTransactionTimeForAllPools();

  const recentActivityThreshold = Date.now() - DAYS_FOR_RECENT_ACTIVITY * 24 * 60 * 60 * 1000;
  const poolIdsWithRecentTransactions = new Set(
    latestTransactionTimeForAllPools
      .filter(({ latestBlockUnixtime }) => latestBlockUnixtime * 1000 >= recentActivityThreshold)
      .map(({ pool_id }) => pool_id)
  );

  const poolAgeThreshold = Date.now() - DAYS_FOR_POOL_AGE * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  // Filter pool IDs based on the age and recent activity
  const relevantPoolIds = await Promise.all(
    allPoolIds.map(async (poolId) => {
      const creationTimestamp = await getCreationTimestampBy({ id: poolId });

      if (creationTimestamp === null) {
        return null;
      }

      const isYoungerThanThreshold = creationTimestamp * 1000 >= poolAgeThreshold;
      const hasRecentTransaction = poolIdsWithRecentTransactions.has(poolId);

      if (isYoungerThanThreshold || hasRecentTransaction) {
        return poolId;
      } else {
        return null;
      }
    })
  );

  return relevantPoolIds.filter((poolId): poolId is number => poolId !== null);
}

/**
 * Converts an array of pool IDs to their corresponding pool addresses.
 *
 * @param {number[]} poolIds - Array of pool IDs.
 * @returns {Promise<string[]>} - Promise that resolves to an array of pool addresses.
 */
export const getAddressesByPoolIds = async (poolIds: number[]): Promise<string[]> => {
  const addressPromises = poolIds.map((id) => getAddressById(id));
  const addresses = await Promise.all(addressPromises);
  return addresses.filter((address): address is string => address !== null);
};

export async function getPoolsBySourceAddress(poolSourceAddress: string): Promise<string[]> {
  try {
    const matchingPools = await Pool.findAll({
      where: {
        source_address: {
          [Op.iLike]: poolSourceAddress,
        },
      },
    });

    const poolAddresses = matchingPools.map((pool) => pool.address);
    return poolAddresses;
  } catch (error) {
    console.error('Error fetching pools by source address:', error);
    throw error;
  }
}

export async function getPoolIdsByAddresses(poolAddresses: string[]): Promise<(number | null)[]> {
  const poolIdsPromises = poolAddresses.map(async (address) => {
    return await getPoolIdByPoolAddress(address);
  });

  const poolIds = await Promise.all(poolIdsPromises);
  return poolIds;
}

export async function getPoolIdsFromPoolAddresses(poolAddresses: string[]): Promise<number[]> {
  const res = [];
  for (const poolAddress of poolAddresses) {
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    if (!poolId) continue;
    res.push(poolId);
  }
  return res;
}
