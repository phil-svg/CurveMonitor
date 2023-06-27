import { Transactions, TransactionData } from "../../../models/Transactions.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import eventEmitter from "../../goingLive/EventEmitter.js";

export async function saveTransaction(transactionData: TransactionData): Promise<Transactions> {
  try {
    eventEmitter.emit("new tx for demo room", transactionData);
    const transaction = await Transactions.create(transactionData);
    return transaction;
  } catch (error) {
    console.error("Error saving transaction:", error);
    throw error;
  }
}

export type TransactionCoinData = {
  tx_id: number;
  coin_id: number;
  amount: number;
  direction: string;
};

export async function saveCoins(coins: { tx_id: number; COIN_ID: number; coinAmount: number; direction: string }[]): Promise<void> {
  try {
    for (const coin of coins) {
      // Check if coinAmount is zero
      if (coin.coinAmount === 0) {
        continue; // Skip to next iteration if coinAmount is zero
      }

      const transactionCoinData = {
        tx_id: coin.tx_id,
        coin_id: coin.COIN_ID,
        amount: coin.coinAmount,
        direction: coin.direction,
      };
      await TransactionCoins.create(transactionCoinData);
    }
  } catch (error) {
    console.error("Error saving coin data:", error);
    throw error;
  }
}

export async function transactionExists(eventId: number): Promise<boolean> {
  const existingTransaction = await Transactions.findOne({ where: { event_id: eventId } });
  return !!existingTransaction;
}
