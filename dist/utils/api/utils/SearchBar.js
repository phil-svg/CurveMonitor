import { Op, Sequelize } from "sequelize";
import { fn, col } from "sequelize";
import { Pool } from "../../../models/Pools.js";
import { Transactions } from "../../../models/Transactions.js";
import { getIdByAddress } from "../../postgresTables/readFunctions/Pools.js";
import { manualLaborLabels } from "./PoolNamesManualLabor.js";
import { Coins } from "../../../models/Coins.js";
async function getPoolTransactionCount(poolId) {
    if (poolId === null) {
        return 0;
    }
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
        },
        order: [["tx_id", "DESC"]],
        limit: 2500,
    });
    return transactions.length;
}
export async function getModifiedPoolName(poolAddress) {
    const lowercasedAddress = poolAddress.toLowerCase();
    if (manualLaborLabels.hasOwnProperty(lowercasedAddress)) {
        return manualLaborLabels[lowercasedAddress];
    }
    const poolId = await getIdByAddress(poolAddress);
    if (poolId === null) {
        return null;
    }
    const pool = await Pool.findByPk(poolId);
    if (!pool || !pool.name)
        return null;
    let name = pool.name;
    // If the name starts with "Curve.fi ", remove this part
    if (name.startsWith("Curve.fi ")) {
        name = name.replace("Curve.fi ", "");
    }
    const nameParts = name.split(":");
    if (nameParts.length > 1) {
        // Take the second part of the name (after the colon) and remove leading and trailing spaces
        return nameParts[1].trim();
    }
    else {
        return name;
    }
}
async function sortPoolDataByTransactionCount(poolAddresses, poolIds) {
    // Get transaction counts for each pool id
    const poolTransactionCounts = await Promise.all(poolIds.map(getPoolTransactionCount));
    // Create an array of pool objects with address and transaction count
    const poolDataPromises = poolAddresses.map(async (poolAddress, index) => {
        return {
            address: poolAddress,
            transactionCount: poolTransactionCounts[index],
        };
    });
    const poolData = await Promise.all(poolDataPromises);
    // Sort the array by transaction count
    poolData.sort((a, b) => b.transactionCount - a.transactionCount);
    // Return the sorted pool addresses and transaction counts (limit to 8)
    return poolData.slice(0, 8);
}
async function addPoolNamesToData(poolData) {
    // Create an array of pool objects with address and name
    const poolDataWithNamesPromises = poolData.map(async (pool) => {
        const poolName = await getModifiedPoolName(pool.address);
        return {
            address: pool.address,
            name: poolName !== undefined ? poolName : null,
        };
    });
    const poolDataWithNames = await Promise.all(poolDataWithNamesPromises);
    // Return the data with added names
    return poolDataWithNames;
}
async function searchPoolsByAddress(userInput) {
    const userInputFormatted = userInput.toLowerCase();
    // Search for pools where the address contains the user input
    const pools = await Pool.findAll({
        attributes: ["address", "id"],
        where: {
            [Op.and]: [Sequelize.where(fn("lower", col("address")), "LIKE", "%" + userInputFormatted + "%")],
        },
    });
    // Convert array of pool instances to array of addresses
    const poolAddresses = pools.map((pool) => pool.address);
    const poolIds = pools.map((pool) => pool.id);
    return { poolAddresses, poolIds };
}
async function searchPoolsByCoinSymbol(userInput) {
    if (!userInput) {
        return null;
    }
    const userInputFormatted = userInput.toLowerCase();
    // Search for coins where the symbol starts with the user input
    const coins = await Coins.findAll({
        attributes: ["address"],
        where: Sequelize.where(fn("lower", col("symbol")), Op.like, userInputFormatted + "%"),
    });
    const coinAddresses = coins.map((coin) => coin.get("address"));
    // Get all pools
    const allPools = await Pool.findAll({
        attributes: ["address", "id", "coins"],
    });
    // Filter pools that contain the coin
    const pools = allPools.filter((pool) => {
        const poolCoins = pool.get("coins");
        return poolCoins && poolCoins.some((coin) => coinAddresses.includes(coin));
    });
    const poolAddresses = pools.map((pool) => pool.get("address"));
    const poolIds = pools.map((pool) => pool.get("id"));
    return { poolAddresses, poolIds };
}
async function searchPoolsByCoinAddress(coinAddress) {
    const coinAddressFormatted = coinAddress.toLowerCase();
    // Search for the coin in the Coins table
    const coin = await Coins.findOne({
        attributes: ["address"],
        where: Sequelize.where(fn("lower", col("address")), Op.like, coinAddressFormatted + "%"),
    });
    if (!coin || !coin.get("address")) {
        return null;
    }
    // Get all pools
    const allPools = await Pool.findAll({
        attributes: ["address", "id", "coins"],
    });
    // Filter pools that contain the coin
    const pools = allPools.filter((pool) => {
        const poolCoins = pool.get("coins");
        return poolCoins && poolCoins.includes(coin.get("address"));
    });
    const poolAddresses = pools.map((pool) => pool.get("address"));
    const poolIds = pools.map((pool) => pool.get("id"));
    return { poolAddresses, poolIds };
}
export async function getSuggestions(userInput) {
    // Validate user input
    if (!userInput || typeof userInput !== "string" || userInput.trim() === "") {
        return [];
    }
    let resultsByAddress = null;
    let resultsByCoinAddress = null;
    let resultsByCoinSymbol = null;
    if (userInput.startsWith("0x")) {
        // If the input starts with "0x", it could be either a pool address or a coin address
        resultsByAddress = await searchPoolsByAddress(userInput);
        resultsByCoinAddress = await searchPoolsByCoinAddress(userInput);
    }
    else {
        resultsByCoinSymbol = await searchPoolsByCoinSymbol(userInput);
    }
    // Create a new object to store combined results
    let combinedResult = { poolAddresses: [], poolIds: [] };
    // Combine the results
    if (resultsByAddress) {
        combinedResult.poolAddresses.push(...resultsByAddress.poolAddresses);
        combinedResult.poolIds.push(...resultsByAddress.poolIds);
    }
    if (resultsByCoinAddress) {
        combinedResult.poolAddresses.push(...resultsByCoinAddress.poolAddresses);
        combinedResult.poolIds.push(...resultsByCoinAddress.poolIds);
    }
    if (resultsByCoinSymbol) {
        combinedResult.poolAddresses.push(...resultsByCoinSymbol.poolAddresses);
        combinedResult.poolIds.push(...resultsByCoinSymbol.poolIds);
    }
    if (!combinedResult.poolAddresses.length)
        return [];
    // Remove duplicates
    combinedResult.poolAddresses = [...new Set(combinedResult.poolAddresses)];
    combinedResult.poolIds = [...new Set(combinedResult.poolIds)];
    const sortedPoolData = await sortPoolDataByTransactionCount(combinedResult.poolAddresses, combinedResult.poolIds);
    const sortedPoolDataWithNames = await addPoolNamesToData(sortedPoolData);
    return sortedPoolDataWithNames;
}
//# sourceMappingURL=SearchBar.js.map