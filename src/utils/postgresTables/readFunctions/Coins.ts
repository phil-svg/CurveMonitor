import { Op, QueryTypes } from 'sequelize';
import { Coins } from '../../../models/Coins.js';
import { getLpTokenBy } from './Pools.js';
import { sequelize } from '../../../config/Database.js';
import { toChecksumAddress } from '../../helperFunctions/Web3.js';

export async function getCoinIdByAddress(address: string): Promise<number | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        address: {
          [Op.iLike]: address.toLowerCase(),
        },
      },
    });

    return coin ? coin.id : null;
  } catch (error) {
    console.error('Error finding coin by address:', error);
    throw error;
  }
}

interface ExistsResult {
  exists: boolean; // Ensure this matches the SQL "AS exists" exactly.
}

/**
 * Checks if a coin exists in the database by its address using a raw SQL query.
 * @param address The address of the coin to check.
 * @returns A Promise resolving to true if the coin exists, otherwise false.
 */
export async function coinExistsByAddress(address: string): Promise<boolean> {
  const query = `
        SELECT EXISTS (
            SELECT 1 FROM "coins"
            WHERE lower(address) = lower(:address)
        ) AS "exists";
    `;

  try {
    const results = await sequelize.query<any>(query, {
      replacements: { address }, // Safely inject the address into the query
      type: QueryTypes.SELECT,
      raw: true,
    });

    if (results.length === 0) {
      return false;
    }

    const result: ExistsResult = results[0];
    return result.exists;
  } catch (error) {
    console.error(`Error checking existence of coin by address ${address}:`, error);
    return false; // Return false in case of an error
  }
}

export async function findCoinDecimalsById(id: number): Promise<number | null> {
  try {
    const coin = await Coins.findByPk(id);

    return coin && coin.decimals !== undefined ? coin.decimals : null;
  } catch (error) {
    console.error('Error finding coin decimals by id:', error);
    throw error;
  }
}

export async function findCoinAddressById(id: number): Promise<string | null> {
  const coin = await Coins.findByPk(id);
  if (!coin) return null;

  return coin.address!;
}

export async function findCoinAddressesByIds(ids: number[]): Promise<string[]> {
  try {
    const coins = await Coins.findAll({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    });

    // Filter out any undefined or null addresses before returning
    return coins.map((coin) => coin.address).filter(Boolean) as string[];
  } catch (error) {
    console.error('Error finding coin addresses by ids:', error);
    throw error;
  }
}

export async function findCoinSymbolByAddress(address: string): Promise<string | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        address: {
          [Op.iLike]: address.toLowerCase(),
        },
      },
    });

    return coin && coin.symbol !== undefined ? coin.symbol : null;
  } catch (error) {
    console.error('Error finding coin symbol by address:', error);
    throw error;
  }
}

export async function findCoinAddressBySymbol(symbol: string): Promise<string | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        symbol: symbol,
      },
    });
    if (!coin) return null;

    return coin.address!;
  } catch (error) {
    console.error('Error finding coin address by symbol:', error);
    throw error;
  }
}

export async function findCoinSymbolById(id: number): Promise<string | null> {
  try {
    const coin = await Coins.findByPk(id);

    return coin && coin.symbol !== undefined ? coin.symbol : null;
  } catch (error) {
    console.error('Error finding coin symbol by id:', error);
    throw error;
  }
}

export const getLpTokenIdByPoolId = async (poolId: number): Promise<number | null> => {
  const lpTokenAddress = await getLpTokenBy({ id: poolId });
  if (!lpTokenAddress) {
    return null;
  }
  const lpTokenId = await getCoinIdByAddress(lpTokenAddress);
  return lpTokenId;
};

export interface CoinDetails {
  address: string;
  symbol: string | null;
  decimals: number | null;
}

/**
 * Processes an array of Ethereum addresses to include both the lowercase and checksummed versions.
 * @param tokenAddresses Array of Ethereum addresses.
 * @returns An array containing both the lowercase and checksummed versions of each address.
 */
function doulbeCaseCheckAddresses(tokenAddresses: string[]): string[] {
  const processedAddresses: string[] = [];

  tokenAddresses.forEach((address) => {
    const lowerCaseAddress = address.toLowerCase(); // Convert address to lowercase
    const checksumAddress = toChecksumAddress(lowerCaseAddress); // Convert to checksum address
    processedAddresses.push(lowerCaseAddress, checksumAddress); // Add both to the array
  });

  return processedAddresses;
}

/**
 * Fetches details for a list of token addresses including symbol and decimals.
 * @param tokenAddresses Array of token addresses.
 * @returns A Promise resolving to an array of objects with token details.
 */
export async function getTokenDetailsForTokenArray(tokenAddresses: string[]): Promise<CoinDetails[]> {
  const addressArray = doulbeCaseCheckAddresses(tokenAddresses);
  const placeholders = addressArray.map(() => '?').join(', '); // Create placeholders for SQL query

  const query = `
        SELECT address, symbol, decimals
        FROM coins
        WHERE address IN (${placeholders});
    `;

  try {
    const tokenDetails = await sequelize.query<CoinDetails>(query, {
      replacements: addressArray, // Insert token addresses into placeholders
      type: QueryTypes.SELECT,
      raw: true,
    });

    return tokenDetails;
  } catch (error) {
    console.error('Error retrieving token details:', error);
    return []; // Return an empty array on error
  }
}
