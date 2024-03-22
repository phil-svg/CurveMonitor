import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Transactions } from "../../../models/Transactions.js";
import { ExtendedTransactionData, TransactionCoin } from "../../Interfaces.js";
import { getTokenPriceWithTimestampFromDb } from "../../postgresTables/readFunctions/PriceMap.js";

export async function priceTransaction(transactionData: ExtendedTransactionData): Promise<number | null> {
  let coins: TransactionCoin[] = [];

  if (Array.isArray(transactionData.transactionCoins)) {
    coins = [...coins, ...transactionData.transactionCoins];
  }

  switch (transactionData.transaction_type) {
    case "swap":
      for (const coin of coins) {
        const price = await getTokenPriceWithTimestampFromDb(coin.coin_id, transactionData.block_unixtime);
        if (price !== null) {
          return price * Number(coin.amount); // Return as soon as we get a price.
        }
      }
      break;
    case "deposit":
    case "remove":
      let totalValue = 0;
      for (const coin of coins) {
        const price = await getTokenPriceWithTimestampFromDb(coin.coin_id, transactionData.block_unixtime);
        if (price !== null) {
          totalValue += price * Number(coin.amount);
        }
      }
      if (totalValue > 0) {
        return totalValue; // Return the total value of the coins.
      }
      break;
    default:
      console.log(`Unknown transaction type: ${transactionData.transaction_type}`);
      break;
  }

  return null; // Return null if no price could be fetched for any coin.
}

/**
 * Calculates the total volume in USD of all "out" coins in a given transaction.
 * @param txId The ID of the transaction to process.
 * @returns The total volume in USD, or null if the transaction or coin prices are not found.
 */
export async function priceTransactionFromTxId(txId: number): Promise<number | null> {
  try {
    const transaction = await Transactions.findByPk(txId, {
      include: [TransactionCoins],
    });

    if (!transaction || !transaction.transactionCoins) {
      console.log(`Transaction with ID ${txId} not found.`);
      return null;
    }

    // console.log("transaction.transactionCoins", transaction.transactionCoins);
    // console.log("transaction.tx_hash", transaction.tx_hash);

    let totalVolume = 0;
    transaction.transactionCoins.forEach((coin) => {
      if (coin.direction === "out" && coin.dollar_value != null) {
        totalVolume += Number(coin.dollar_value);
      }
    });

    return totalVolume;
  } catch (error) {
    console.error(`Error calculating total out volume for transaction ID ${txId}:`, error);
    return null;
  }
}
