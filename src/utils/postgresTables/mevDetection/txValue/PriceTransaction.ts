import { ExtendedTransactionData, TransactionCoin } from "../../../Interfaces.js";
import { findCoinAddressById } from "../../readFunctions/Coins.js";
import { getHistoricalTokenPriceFromDefiLlama } from "./DefiLlama.js";

export async function priceTransaction(transactionData: ExtendedTransactionData) {
  let coins: TransactionCoin[] = [];

  if (Array.isArray(transactionData.transactionCoins)) {
    coins = [...coins, ...transactionData.transactionCoins];
  }

  switch (transactionData.transaction_type) {
    case "swap":
      for (const coin of coins) {
        const coinAddress = await findCoinAddressById(coin.coin_id);
        const price = await getHistoricalTokenPriceFromDefiLlama(coinAddress!, transactionData.block_unixtime);
        if (price !== null) {
          return price * Number(coin.amount); // Return as soon as we get a price.
        }
      }
      break;
    case "deposit":
    case "remove":
      let totalValue = 0;
      for (const coin of coins) {
        const coinAddress = await findCoinAddressById(coin.coin_id);
        const price = await getHistoricalTokenPriceFromDefiLlama(coinAddress!, transactionData.block_unixtime);
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
