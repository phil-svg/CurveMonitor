import ExcelJS from "exceljs";
import { Op } from "sequelize";
import { formatISO, startOfWeek } from "date-fns";
import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { Pool } from "../../../models/Pools.js";
import { Transactions } from "../../../models/Transactions.js";
import { Blocks } from "../../../models/Blocks.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
export async function aggregateCexDexBotVolumeOverTime(botAddress, poolAddress) {
    var _a;
    const pool = await Pool.findOne({ where: { address: { [Op.iLike]: poolAddress.toLowerCase() } } });
    if (!pool) {
        throw new Error("Pool not found");
    }
    const cexDexArbsEntries = await CexDexArbs.findAll({
        where: { bot_address: { [Op.iLike]: botAddress.toLowerCase() }, pool_id: pool.id },
        include: [{ model: Transactions, as: "transaction" }],
    });
    const weeklyVolumesMap = new Map();
    for (const entry of cexDexArbsEntries) {
        const txId = entry.transaction.tx_id;
        const transaction = await Transactions.findByPk(txId);
        if (!transaction)
            continue;
        const block = await Blocks.findByPk(transaction.block_number);
        if (!block)
            continue;
        const transactionCoins = await TransactionCoins.findAll({ where: { tx_id: txId } });
        const txVolume = transactionCoins.reduce((sum, coin) => sum + (Number(coin.dollar_value) || 0), 0);
        const txDate = new Date(block.timestamp * 1000);
        const weekStart = startOfWeek(txDate, { weekStartsOn: 1 });
        const weekStartStr = formatISO(weekStart, { representation: "date" });
        const currentVolume = ((_a = weeklyVolumesMap.get(weekStartStr)) === null || _a === void 0 ? void 0 : _a.volume) || 0;
        weeklyVolumesMap.set(weekStartStr, { weekStart: weekStartStr, volume: currentVolume + txVolume });
    }
    const volIn = 1000000;
    return Array.from(weeklyVolumesMap.values()).map((item) => ({
        weekStart: item.weekStart,
        volume: Math.round((item.volume / volIn) * 100) / 100, // Adjusted to calculate the ratio and round to two decimal places
    }));
}
export async function writeDBotVolOverTimeataToExcel(weeklyVolumes) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Weekly Volumes");
    // Define the columns
    worksheet.columns = [
        { header: "Week Starting", key: "weekStart", width: 15 },
        { header: "Total Volume", key: "volume", width: 20 },
    ];
    // Add the data
    worksheet.addRows(weeklyVolumes);
    // Save the workbook to a file
    await workbook.xlsx.writeFile("WeeklyVolumes.xlsx");
    console.log("Excel file created.");
}
//# sourceMappingURL=BotVolOverTime.js.map