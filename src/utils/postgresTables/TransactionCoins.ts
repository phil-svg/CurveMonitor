import { Op } from "sequelize";
import { PriceMap } from "../../models/PriceMap.js";
import { TransactionCoins } from "../../models/TransactionCoins.js";
import { Transactions } from "../../models/Transactions.js";
import { logProgress } from "../helperFunctions/QualityOfLifeStuff.js";
import { getAllUniqueCoinIds } from "./readFunctions/PriceMap.js";
import { FirstPriceTimestamp } from "../../models/FirstTokenPrices.js";

async function txOlderThanFirstPrice(transactionCoin: TransactionCoins): Promise<boolean> {
  // Extract coin_id and block_unixtime from the transaction
  const { coin_id } = transactionCoin;
  const transactionUnixTime = transactionCoin.transaction.block_unixtime;

  // Find the first price timestamp for the given coin_id
  const firstPriceEntry = await FirstPriceTimestamp.findOne({
    where: {
      coin_id: coin_id,
    },
  });

  // If there's no first price timestamp entry for the coin or if firstTimestampDefillama is null or undefined, return false
  if (!firstPriceEntry || firstPriceEntry.firstTimestampDefillama === null || firstPriceEntry.firstTimestampDefillama === undefined) {
    return false;
  }

  // Return true if the transaction's timestamp is less than the first price timestamp
  return transactionUnixTime < firstPriceEntry.firstTimestampDefillama;
}

// Function to filter for only those coin IDs that are priced on DeFiLlama
async function filterForPricedByDefiLlama(uniqueCoinIds: number[]): Promise<number[]> {
  if (uniqueCoinIds.length === 0) return [];

  try {
    const pricedCoins = await FirstPriceTimestamp.findAll({
      where: {
        coin_id: uniqueCoinIds,
        firstTimestampDefillama: {
          [Op.ne]: 420,
        },
      },
      attributes: ["coin_id"],
    });

    const pricedCoinIds = pricedCoins.map((entry) => entry.coin_id);
    return pricedCoinIds;
  } catch (error) {
    console.error("Error filtering for priced by DeFiLlama:", error);
    return [];
  }
}

// Fetching all transaction coins entries that don't have a dollar value
export async function populateTransactionCoinsWithDollarValues(): Promise<void> {
  const batchSize = 10000;
  let offset = 0;
  let counter = 0;
  let totalRecordsProcessed = 0;
  let totalTimeTaken = 0;
  const uniqueCoinIds = await getAllUniqueCoinIds();
  const uniquePricedCoinIds = await filterForPricedByDefiLlama(uniqueCoinIds);

  while (true) {
    const startTime = new Date().getTime();
    const transactions = await TransactionCoins.findAll({
      where: {
        dollar_value: null,
        coin_id: {
          [Op.in]: uniquePricedCoinIds, // Filter by coin_ids that are in the uniquePricedCoinIds array
        },
      },
      include: [{ model: Transactions, attributes: ["block_unixtime", "tx_hash"], required: true }],
      limit: batchSize,
      offset: offset,
    });

    if (transactions.length === 0) {
      break; // Exit the loop if no more records are found
    }

    for (const transactionCoin of transactions) {
      counter++;
      const transactionUnixTime = transactionCoin.transaction.block_unixtime;

      logProgress("Populating prices", 1000, counter, totalTimeTaken, totalRecordsProcessed + transactions.length);

      let priceEntry = await PriceMap.findOne({
        where: {
          coin_id: transactionCoin.coin_id,
          price_timestamp: { [Op.lte]: transactionUnixTime },
        },
        order: [["price_timestamp", "DESC"]],
        limit: 1,
      });

      if (!priceEntry) {
        const tooOld = await txOlderThanFirstPrice(transactionCoin);
        if (tooOld) {
          const dollarValue = 0.000000042; // mock number in case of different solution which covers pricing of super early/old tx.
          transactionCoin.dollar_value = dollarValue;
          try {
            await transactionCoin.save();
          } catch (err) {
            console.error("Error updating transaction coin:", err);
          }
        }
      }

      if (priceEntry) {
        let dollarValue = priceEntry.coinPriceUsd * transactionCoin.amount;
        if (isNaN(transactionCoin.amount)) {
          dollarValue = 0.000000043; // mock number in case of different solution which covers NaN tx (5,000/3,600,000).
        }
        if (dollarValue <= 1e12 * 15) {
          transactionCoin.dollar_value = dollarValue;
          try {
            await transactionCoin.save();
          } catch (err) {
            console.error("Error updating transaction coin:", err);
          }
        } else {
          console.log("funny price");
        }
      } else {
        // console.log("missing priceEntry", transactionCoin.coin_id, transactionCoin.transaction.tx_hash);
      }
    }

    const endTime = new Date().getTime();
    totalTimeTaken += endTime - startTime;
    totalRecordsProcessed += transactions.length;
    offset += batchSize;
  }

  console.log(`[✓] Prices populated successfully.`);
}
