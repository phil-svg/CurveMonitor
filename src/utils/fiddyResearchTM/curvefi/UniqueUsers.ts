import { sequelize } from '../../../config/Database.js';
import Sequelize from 'sequelize';

/**
 * Gets the number of unique 'trader' addresses for swap transactions in the year 2024.
 */
async function getUniqueBuyersFromEventFor2024SwapsOnly(): Promise<number> {
  // Define the start and end of the year 2024 in UNIX timestamp format
  const startOfYear = new Date('2024-01-01T00:00:00Z').getTime() / 1000;
  const endOfYear = new Date('2024-12-31T23:59:59Z').getTime() / 1000;

  // Raw SQL query to fetch unique 'trader' addresses in swap transactions within blocks from 2024
  const query = `
    SELECT DISTINCT t."trader"
    FROM transactions AS t
    JOIN blocks AS b ON t."block_number" = b."block_number"
    WHERE b."timestamp" BETWEEN ${startOfYear} AND ${endOfYear}
      AND t."transaction_type" = 'swap';
  `;

  // Execute the query
  const result = (await sequelize.query(query, {
    type: Sequelize.QueryTypes.SELECT,
  })) as { trader: string }[];

  // Result is an array of objects with a 'trader' property
  const uniqueTraders = result.map((row: { trader: string }) => row.trader);

  console.log(`Number of unique 'trader' addresses in swap transactions for 2024: ${uniqueTraders.length}`);
  return uniqueTraders.length;
}

/**
 * Gets the number of unique 'from' addresses for swap transactions in the year 2024 where the trader is a specific router.
 * @param routerAddress The router address to filter by.
 */
async function getUniqueFromAddressesForSwapsByRouter(routerAddress: string): Promise<number> {
  // Define the start and end of the year 2024 in UNIX timestamp format
  const startOfYear = new Date('2024-01-01T00:00:00Z').getTime() / 1000;
  const endOfYear = new Date('2024-12-31T23:59:59Z').getTime() / 1000;

  // Raw SQL query to fetch unique 'from' addresses in swap transactions within blocks from 2024
  // where the trader is the router
  const query = `
    SELECT DISTINCT td."from"
    FROM transaction_details AS td
    JOIN transactions AS t ON td."tx_id" = t."tx_id"
    JOIN blocks AS b ON t."block_number" = b."block_number"
    WHERE b."timestamp" BETWEEN ${startOfYear} AND ${endOfYear}
      AND t."transaction_type" = 'swap'
      AND LOWER(t."trader") = LOWER('${routerAddress}');
  `;

  // Execute the query
  const result = (await sequelize.query(query, {
    type: Sequelize.QueryTypes.SELECT,
  })) as { from: string }[];

  // Result is an array of objects with a 'from' property
  const uniqueFromAddresses = result.map((row: { from: string }) => row.from);

  console.log(
    `Number of unique 'from' addresses in swap transactions for 2024 linked to router ${routerAddress}: ${uniqueFromAddresses.length}`
  );
  return uniqueFromAddresses.length;
}

export async function uniqueUsersThings() {
  const curveRouterV1 = '0xF0d4c12A5768D806021F80a262B4d39d26C58b8D';
  await getUniqueBuyersFromEventFor2024SwapsOnly();
  await getUniqueFromAddressesForSwapsByRouter(curveRouterV1);
}
