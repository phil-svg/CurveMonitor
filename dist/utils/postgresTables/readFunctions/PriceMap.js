import { Op, Sequelize } from "sequelize";
import { PriceMap } from "../../../models/PriceMap.js";
export async function getLatestStoredPriceTimestampForCoin(coinId) {
    const latestPriceEntry = await PriceMap.findOne({
        where: {
            coin_id: coinId,
        },
        order: [["price_timestamp", "DESC"]],
        attributes: ["price_timestamp"],
    });
    return latestPriceEntry ? latestPriceEntry.getDataValue("price_timestamp") : null;
}
export async function getEthPriceWithTimestampFromTable(unixtime) {
    try {
        const ethPriceData = await PriceMap.findOne({
            where: {
                coin_id: 200,
                priceTimestamp: {
                    [Op.lte]: unixtime,
                },
            },
            order: [["priceTimestamp", "DESC"]],
            limit: 1,
        });
        if (ethPriceData) {
            return ethPriceData.coinPriceUsd;
        }
        return null;
    }
    catch (error) {
        console.error("Error fetching ETH price data:", error);
        throw error;
    }
}
/**
 * Fetches the price with a timestamp for a specified token.
 * @param tokenId The ID of the token to fetch the price for.
 * @param unixtime The timestamp to use for fetching the price.
 * @returns The token price at the specified timestamp or null if not found.
 */
export async function getTokenPriceWithTimestampFromDb(tokenId, unixtime) {
    try {
        const tokenPriceData = await PriceMap.findOne({
            where: {
                coin_id: tokenId,
                priceTimestamp: {
                    [Op.lte]: unixtime,
                },
            },
            order: [["priceTimestamp", "DESC"]],
            limit: 1,
        });
        if (tokenPriceData) {
            return tokenPriceData.coinPriceUsd;
        }
        return null;
    }
    catch (error) {
        console.error(`Error fetching price data for token ID ${tokenId}:`, error);
        throw error;
    }
}
export async function getAllUniqueCoinIds() {
    try {
        const uniqueCoinIds = await PriceMap.findAll({
            attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("coin_id")), "coin_id"]],
            raw: true,
        });
        return uniqueCoinIds.map((entry) => entry.coin_id);
    }
    catch (error) {
        console.error("Error fetching unique coin IDs:", error);
        return [];
    }
}
//# sourceMappingURL=PriceMap.js.map