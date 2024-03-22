import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { priceTransactionFromTxId } from "../../TokenPrices/txValue/PriceTransaction.js";
import ExcelJS from "exceljs";

function determineRange(volume: number): string {
  const upperLimit = 180000; // Maximum limit
  const stepSize = 2500; // Bucket size

  if (volume >= upperLimit) {
    return `Ignored`; // Transactions above upper limit are ignored
  }

  const rangeIndex = Math.floor(volume / stepSize);
  const lowerLimit = (rangeIndex * stepSize) / 1000; // Convert to 'k'
  const upperLimitRange = ((rangeIndex + 1) * stepSize) / 1000; // Convert to 'k'

  return `${lowerLimit}-${upperLimitRange}`; // Removed 'k$' from range
}

interface VolumeSummary {
  count: number;
  totalVolume: number;
}

export async function summarizeCexDexArbsVolumes(): Promise<{ [range: string]: VolumeSummary }> {
  const volumeSummary: { [range: string]: VolumeSummary } = {};
  const arbs = await CexDexArbs.findAll();

  for (const arb of arbs) {
    const volume = await priceTransactionFromTxId(arb.tx_id);
    if (volume !== null) {
      const range = determineRange(volume);
      if (range !== "Ignored") {
        // Only process transactions within the desired range
        if (!volumeSummary[range]) {
          volumeSummary[range] = { count: 0, totalVolume: 0 };
        }
        volumeSummary[range].count++;
        volumeSummary[range].totalVolume += volume;
      }
    }
  }

  return volumeSummary;
}

export async function printSortedVolumeSummary() {
  const volumeSummary = await summarizeCexDexArbsVolumes();

  // Convert object to an array of [key, value] pairs and sort them by range
  const sortedSummary = Object.entries(volumeSummary).sort((a, b) => {
    const rangeA = parseInt(a[0].split("-")[0]);
    const rangeB = parseInt(b[0].split("-")[0]);
    return rangeA - rangeB;
  });

  // Print the sorted results
  console.log("Number of Transactions in Each Bucket:");
  sortedSummary.forEach(([range, summary]) => {
    console.log(`${range}: ${summary.count}`);
  });

  console.log("\nTotal Volume in Each Bucket (in Millions):");
  sortedSummary.forEach(([range, summary]) => {
    // Convert total volume to millions and format with no decimal places
    console.log(`${range}: ${(summary.totalVolume / 1e6).toFixed(0)}M$`);
  });

  await saveVolumeSummaryToExcel();
}

async function saveVolumeSummaryToExcel() {
  const volumeSummary = await summarizeCexDexArbsVolumes();
  const sortedSummary = Object.entries(volumeSummary).sort((a, b) => {
    const rangeA = parseInt(a[0].split("-")[0]);
    const rangeB = parseInt(b[0].split("-")[0]);
    return rangeA - rangeB;
  });

  // Create a new workbook and a worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("CexDexArbsVolumes");

  // Add headers
  worksheet.columns = [
    { header: "Range", key: "range", width: 15 },
    { header: "Number of Transactions", key: "count", width: 25 },
    { header: "Total Volume (M$)", key: "totalVolume", width: 25 },
  ];

  // Add data rows
  sortedSummary.forEach(([range, summary]) => {
    worksheet.addRow({
      range,
      count: summary.count,
      // Assign the numerical value directly
      totalVolume: summary.totalVolume / 1e6,
    });
  });

  // Apply number formatting to the 'totalVolume' column
  worksheet.getColumn("totalVolume").numFmt = "#,##0"; // Format as whole number

  // Write the file
  await workbook.xlsx.writeFile("CexDexArbsVolumes.xlsx");
  console.log("Data saved to Excel file.");
}
