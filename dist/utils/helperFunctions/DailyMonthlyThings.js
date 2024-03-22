import { Transactions } from "../../models/Transactions.js";
import { priceTransactionFromTxId } from "../TokenPrices/txValue/PriceTransaction.js";
import ExcelJS from "exceljs";
function convertDateToUnixTime(dateString) {
  return Math.floor(new Date(dateString).getTime() / 1000);
}
function convertFromUnixTime(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toISOString().split("T")[0];
}
// 2024-01-29 format
export async function fetchDailyMonthlyThingsFromTxIdList(fullTxIds, subsetTxIds, startDate, endDate, timeInterval, saveToExcelFlag = false) {
  const startUnix = convertDateToUnixTime(startDate);
  const endUnix = convertDateToUnixTime(endDate);
  let aggregatedData = { fullSet: {}, subset: {} };
  const timeIntervalInSeconds = {
    "1h": 3600,
    "4h": 14400,
    daily: 86400,
    weekly: 604800,
    monthly: 2592000,
  };
  const intervalInSeconds = timeIntervalInSeconds[timeInterval];
  const txPriceMap = {};
  for (const txId of fullTxIds) {
    const transaction = await Transactions.findByPk(txId);
    if (transaction && transaction.block_unixtime >= startUnix && transaction.block_unixtime <= endUnix) {
      let dollarValue = txPriceMap[txId];
      if (dollarValue === undefined) {
        dollarValue = await priceTransactionFromTxId(txId);
        txPriceMap[txId] = dollarValue;
      }
      if (dollarValue !== null) {
        const timeKey = convertFromUnixTime(Math.floor(transaction.block_unixtime / intervalInSeconds) * intervalInSeconds);
        aggregatedData.fullSet[timeKey] = (aggregatedData.fullSet[timeKey] || 0) + Number(dollarValue.toFixed(0));
      }
    }
  }
  for (const txId of subsetTxIds) {
    const transaction = await Transactions.findByPk(txId);
    if (transaction && transaction.block_unixtime >= startUnix && transaction.block_unixtime <= endUnix) {
      const dollarValue = txPriceMap[txId];
      if (dollarValue !== null) {
        const timeKey = convertFromUnixTime(Math.floor(transaction.block_unixtime / intervalInSeconds) * intervalInSeconds);
        aggregatedData.subset[timeKey] = (aggregatedData.subset[timeKey] || 0) + Number(dollarValue.toFixed(0));
      }
    }
  }
  if (saveToExcelFlag) {
    await saveToExcel(aggregatedData);
  }
  return aggregatedData;
}
async function saveToExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    // Create header row
    sheet.columns = [
      { header: "Time", key: "time", width: 20 },
      { header: "Full Set Volume", key: "fullSetVolume", width: 20 },
      { header: "Subset Volume", key: "subsetVolume", width: 20 },
    ];
    // Function to safely convert timestamp to ISO date string
    const safeIsoString = (timestamp) => {
      try {
        const date = new Date(timestamp * 1000);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
        throw new Error("Invalid date");
      } catch (_a) {
        return "Invalid date";
      }
    };
    // Add rows to sheet for full set
    for (const [timestamp, volume] of Object.entries(data.fullSet)) {
      const formattedDate = safeIsoString(Number(timestamp));
      sheet.addRow({
        time: formattedDate,
        fullSetVolume: volume,
      });
    }
    // Add rows to sheet for subset
    for (const [timestamp, volume] of Object.entries(data.subset)) {
      const formattedDate = safeIsoString(Number(timestamp));
      sheet.addRow({
        time: formattedDate,
        subsetVolume: volume,
      });
    }
    // Formatting the columns for date and volume to ensure they are recognized properly by Excel
    sheet.getColumn("time").numFmt = "yyyy-mm-dd";
    sheet.getColumn("fullSetVolume").numFmt = "#,##0";
    sheet.getColumn("subsetVolume").numFmt = "#,##0";
    const fileName = `aggregatedData.xlsx`;
    await workbook.xlsx.writeFile(fileName);
    console.log(`Data saved to ${fileName}`);
  } catch (error) {
    console.error(`Error saving data to Excel:`, error);
  }
}
//# sourceMappingURL=DailyMonthlyThings.js.map
