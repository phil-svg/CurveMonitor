import { Op } from "sequelize";
import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { Pool } from "../../../models/Pools.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Coins } from "../../../models/Coins.js";

export async function countAndSortUniqueBotAddresses() {
  const cexDexArbsEntries = await CexDexArbs.findAll();

  const botAddressCount: Map<string, number> = new Map();

  for (const entry of cexDexArbsEntries) {
    const botAddress = entry.bot_address?.toLowerCase();
    if (botAddress) {
      botAddressCount.set(botAddress, (botAddressCount.get(botAddress) || 0) + 1);
    }
  }

  // Sort by count in ascending order
  const sortedBotAddresses = Array.from(botAddressCount)
    .sort((a, b) => a[1] - b[1]) // Sorting by count
    .map(([address, count]) => ({ address, count }));

  return sortedBotAddresses;
}

export async function countUniquePoolsForBot(botAddress: string): Promise<{ [poolName: string]: number }> {
  const botAddressLower = botAddress.toLowerCase();

  // Find CexDexArbs entries for the bot
  const cexDexArbsEntries = await CexDexArbs.findAll({
    where: {
      bot_address: {
        [Op.iLike]: botAddressLower,
      },
    },
    attributes: ["pool_id"],
  });

  // Extract unique pool IDs
  const uniquePoolIds = [...new Set(cexDexArbsEntries.map((entry) => entry.pool_id))];

  // Fetch corresponding pools
  const pools = await Pool.findAll({
    where: {
      id: uniquePoolIds,
    },
  });

  // Count occurrences of each pool name
  const poolNameCount: { [poolName: string]: number } = {};
  cexDexArbsEntries.forEach((entry) => {
    const pool = pools.find((p) => p.id === entry.pool_id);
    const poolName = pool?.name || "Unknown";
    poolNameCount[poolName] = (poolNameCount[poolName] || 0) + 1;
  });

  // Format and sort the poolNameCount
  const formattedAndSortedPoolNameCount = Object.entries(poolNameCount)
    .map(([name, count]) => {
      // Format the pool name
      let formattedName = name;
      if (formattedName.includes(": ")) {
        formattedName = formattedName.split(": ")[1];
      }
      if (formattedName.startsWith("Curve.fi ")) {
        formattedName = formattedName.replace("Curve.fi ", "");
      }
      return [formattedName, count] as [string, number];
    })
    // Sort by count (descending: b[1] - a[1], ascending: a[1] - b[1])
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [name, count]) => {
      acc[name] = count;
      return acc;
    }, {} as { [poolName: string]: number });

  return formattedAndSortedPoolNameCount;
}

// Function to find the pool ID using the pool address (case insensitive)
export async function findPoolId(poolAddress: string): Promise<number | null> {
  const pool = await Pool.findOne({
    where: { address: { [Op.iLike]: poolAddress.toLowerCase() } },
  });
  return pool ? pool.id : null;
}

// Function to find all CexDexArbs transactions for the bot and a specific pool (case insensitive)
async function findCexDexArbsEntries(botAddress: string, poolId: number): Promise<CexDexArbs[]> {
  return await CexDexArbs.findAll({
    where: {
      bot_address: { [Op.iLike]: botAddress.toLowerCase() },
      pool_id: poolId,
    },
  });
}

// Function to count coin swaps for a bot in a specific pool
export async function countCoinSwapsForBotAndPool(botAddress: string, poolAddress: string): Promise<{ [swap: string]: { count: number; totalVolume: number } }> {
  const poolId = await findPoolId(poolAddress);
  if (poolId === null) {
    console.log("Pool not found");
    return {};
  }

  const cexDexArbsEntries = await findCexDexArbsEntries(botAddress, poolId);
  const transactionIds = cexDexArbsEntries.map((entry) => entry.tx_id);

  // Fetch all transaction coins for these transaction IDs
  const transactionCoins = await TransactionCoins.findAll({
    where: { tx_id: { [Op.in]: transactionIds } },
    include: [Coins], // Include Coins to get coin symbols
  });

  // Count swap occurrences and sum up transaction volumes
  const swapData: { [swap: string]: { count: number; totalVolume: number } } = {};
  transactionCoins.forEach((txCoin) => {
    const direction = txCoin.direction;
    const coinSymbol = txCoin.coin?.symbol || "Unknown";

    // Identify other coin in the swap
    const otherCoins = transactionCoins.filter((c) => c.tx_id === txCoin.tx_id && c.coin_id !== txCoin.coin_id);
    otherCoins.forEach((otherCoin) => {
      const otherCoinSymbol = otherCoin.coin?.symbol || "Unknown";
      const swap = direction === "in" ? `${otherCoinSymbol}->${coinSymbol}` : `${coinSymbol}->${otherCoinSymbol}`;

      if (!swapData[swap]) {
        swapData[swap] = { count: 0, totalVolume: 0 };
      }
      swapData[swap].count += 1;
      swapData[swap].totalVolume += parseFloat(txCoin.dollar_value?.toString() || "0");
    });
  });

  return swapData;
}
