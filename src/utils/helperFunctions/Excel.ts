import ExcelJS from "exceljs";

interface ChunkedData {
  [key: string]: number;
}

/*
example:
 {
  '509000-510000': 1,
  '511000-512000': 1,
  '521000-522000': 1,
  '522000-523000': 1,
 }
*/
export async function saveChunkedDataToExcel(chunkedData: ChunkedData): Promise<void> {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Chunked Data");

    // Define columns
    sheet.columns = [
      { header: "Center", key: "center", width: 15 },
      { header: "Gas Count", key: "gasCount", width: 10 },
    ];

    // Add data to sheet
    for (const [range, count] of Object.entries(chunkedData)) {
      // Calculate the center of the range
      const [start, end] = range.split("-").map(Number);
      const center = start + (end - start) / 2;

      sheet.addRow({ center, gasCount: count });
    }

    // Write to file
    await workbook.xlsx.writeFile("chunkedData2_tricryptoUSDC.xlsx");
    console.log(`Data saved to Excel.`);
  } catch (error) {
    console.error("Error saving data to Excel:", error);
  }
}
