import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Transactions } from "../../../models/Transactions.js";
export async function calculateTotalVolumeAndVolumePerBot() {
    var _a, _b;
    const cexDexArbsEntries = await CexDexArbs.findAll({
        include: [{ model: Transactions, as: "transaction" }],
    });
    let totalVolume = 0;
    const volumePerBot = {};
    for (const entry of cexDexArbsEntries) {
        const txId = entry.transaction.tx_id;
        const transactionCoins = await TransactionCoins.findAll({ where: { tx_id: txId } });
        // Volume is calculated and converted to millions
        const txVolume = transactionCoins.reduce((sum, coin) => sum + (Number(coin.dollar_value) || 0), 0) / 1e6;
        totalVolume += txVolume;
        // Update volume per bot
        const botAddress = (_b = (_a = entry.bot_address) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "unknown";
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
//# sourceMappingURL=GlobalVolume.js.map