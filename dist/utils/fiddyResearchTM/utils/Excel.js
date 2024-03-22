import ExcelJS from "exceljs";
// Function to save search findings to an Excel file
export async function saveJsonToExcel(jsonData, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");
    // Add a header row dynamically based on the keys from the first object
    const headerRow = ["Date", "Daily Volumes", "Sandwich Volumes", "Atomic Arb Volumes", "Cex Dex Arb Volumes", "Organic"];
    worksheet.addRow(headerRow);
    // Iterate over jsonData to add data rows
    for (const [date, volumes] of Object.entries(jsonData)) {
        const row = [date, ...volumes];
        worksheet.addRow(row);
    }
    // Write to an Excel file
    await workbook.xlsx.writeFile(filename);
    console.log(`JSON data has been saved to ${filename}`);
}
export async function saveMostVolGeneratingToAddressesToExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("TopAddressesByVolume");
    // Define columns
    worksheet.columns = [
        { header: "Address", key: "address", width: 30 },
        { header: "Total Volume", key: "volume", width: 20 },
    ];
    // Add data
    data.forEach(([address, volume]) => {
        worksheet.addRow({ address, volume });
    });
    // Write to file
    await workbook.xlsx.writeFile("TopAddressesByVolume.xlsx");
    console.log("Report saved as TopAddressesByVolume.xlsx");
}
export function savePriceImpactThingsToExcel(groupedSwaps, fileName) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Swaps");
    // Add headers
    worksheet.getCell("A1").value = "USD";
    worksheet.getCell("B1").value = "Price Impact";
    // Start from row 2
    let row = 2;
    for (const pair in groupedSwaps) {
        if (groupedSwaps.hasOwnProperty(pair)) {
            const swaps = groupedSwaps[pair];
            for (const swap of swaps) {
                // Add data to the Excel sheet
                worksheet.getCell(`A${row}`).value = swap.swapVolumeUSD;
                worksheet.getCell(`B${row}`).value = swap.priceImpactInPercentage;
                row++;
            }
        }
    }
    // Save the Excel file
    workbook.xlsx
        .writeFile(fileName)
        .then(() => {
        console.log(`Data saved to ${fileName}`);
    })
        .catch((error) => {
        console.error(`Error saving to ${fileName}:`, error);
    });
}
export function saveEnhancedSwapDetailsToExcel(groupedSwaps, fileName) {
    const workbook = new ExcelJS.Workbook();
    Object.entries(groupedSwaps).forEach(([pair, swaps]) => {
        // Create a new worksheet for each pair
        const worksheet = workbook.addWorksheet(pair.replace("/", "-")); // Replace "/" with "-" to avoid issues in sheet names
        // Add headers to the worksheet
        worksheet.addRow(["USD Volume", "Price Impact (%)", "TVL Percentage"]);
        // Populate the worksheet with swap details for the pair
        swaps.forEach((swap) => {
            worksheet.addRow([swap.swapVolumeUSD, swap.priceImpactInPercentage, swap.tvlPercentage]);
        });
        // Optional: Format the worksheet columns for better readability
        worksheet.columns = [
            { header: "USD Volume", key: "usdVolume", width: 15 },
            { header: "Price Impact (%)", key: "priceImpact", width: 18 },
            { header: "TVL Percentage", key: "tvlPercentage", width: 15 },
        ];
    });
    // Save the Excel file
    workbook.xlsx
        .writeFile(fileName)
        .then(() => console.log(`Data saved to ${fileName}`))
        .catch((error) => console.error(`Error saving to ${fileName}:`, error));
}
// Helper function to get all possible bracket ranges based on the existing brackets
function getAllBrackets(brackets) {
    const allBracketsSet = new Set();
    Object.values(brackets).forEach((functionBrackets) => {
        Object.keys(functionBrackets).forEach((bracket) => allBracketsSet.add(bracket));
    });
    return Array.from(allBracketsSet).sort((a, b) => parseInt(a.split("-")[0]) - parseInt(b.split("-")[0]));
}
export async function saveGasUsagesByFunctionNamesAndPoolsAndTimeToExcel(gasUsageBrackets) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Gas Usages");
    const fileName = "gasUsages.xlsx"; // Ensure the path is correct
    // Define a function to calculate the midpoint
    const calculateMidpointForBracket = (bracket) => {
        const [start, end] = bracket.split("-").map(Number);
        return (start + end) / 2;
    };
    // Prepare the headers and initial row index for data
    let columnIndex = 1; // Start from the first column
    Object.keys(gasUsageBrackets).forEach((functionName) => {
        worksheet.getCell(1, columnIndex).value = `${functionName} (bracket)`;
        worksheet.getCell(1, columnIndex + 1).value = `${functionName} (count)`;
        columnIndex += 2; // Move to the next two columns for the next function name
    });
    // Iterate through each bracket to write data
    const allBrackets = Object.keys(gasUsageBrackets[Object.keys(gasUsageBrackets)[0]]); // Assuming all functions have the same brackets
    allBrackets.forEach((bracket, rowIndex) => {
        let dataColumnIndex = 1;
        Object.keys(gasUsageBrackets).forEach((functionName) => {
            const midpoint = calculateMidpointForBracket(bracket);
            const count = gasUsageBrackets[functionName][bracket] || 0; // Default to 0 if bracket not present
            // Ensure count is a number to avoid NaN
            const validCount = Number.isNaN(count) ? 0 : count;
            worksheet.getCell(rowIndex + 2, dataColumnIndex).value = midpoint;
            worksheet.getCell(rowIndex + 2, dataColumnIndex + 1).value = validCount;
            dataColumnIndex += 2; // Move to the next set of columns for the next function name
        });
    });
    // Save the Excel file
    await workbook.xlsx.writeFile(fileName);
    console.log(`Data saved to ${fileName}`);
}
//# sourceMappingURL=Excel.js.map