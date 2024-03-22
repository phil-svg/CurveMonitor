import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Transactions } from "../../../models/Transactions.js";

export interface BotVolume {
  [botAddress: string]: number;
}

export async function calculateTotalVolumeAndVolumePerBot(): Promise<void> {
  const cexDexArbsEntries = await CexDexArbs.findAll({
    include: [{ model: Transactions, as: "transaction" }],
  });

  let totalVolume = 0;
  const volumePerBot: BotVolume = {};

  for (const entry of cexDexArbsEntries) {
    const txId = entry.transaction.tx_id;
    const transactionCoins = await TransactionCoins.findAll({ where: { tx_id: txId } });

    // Volume is calculated and converted to millions
    const txVolume = transactionCoins.reduce((sum, coin) => sum + (Number(coin.dollar_value) || 0), 0) / 1e6;
    totalVolume += txVolume;

    // Update volume per bot
    const botAddress = entry.bot_address?.toLowerCase() ?? "unknown";
    volumePerBot[botAddress] = (volumePerBot[botAddress] || 0) + txVolume;
  }

  // Sort bot addresses by volume
  const sortedBots = Object.entries(volumePerBot).sort((a, b) => b[1] - a[1]);

  console.log("Sorted Bot Volumes (in millions):");
  sortedBots.forEach(([address, volume]) => {
    console.log(`${address}: ${volume.toFixed(2)}M`);
  });

  console.log(`Total CexDexArbs Volume: ${totalVolume.toFixed(2)}M`);
}
