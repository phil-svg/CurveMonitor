import { promises as fsPromises } from "fs";
async function saveToJsonFile(filePath, data) {
    try {
        await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`Data successfully written to ${filePath}`);
    }
    catch (error) {
        console.error("An error occurred while writing to the JSON file:", error);
    }
}
function createDummyBarChartRaceData(startYear, startMonth, endYear, endMonth, addresses) {
    const data = [["Label", "Value", "URL"]]; // Initialize headers
    // Add months to the headers
    for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
            if ((year > startYear || (year === startYear && month >= startMonth)) && (year < endYear || (year === endYear && month <= endMonth))) {
                const monthString = `${year}-${month.toString().padStart(2, "0")}`;
                data[0].push(monthString);
            }
        }
    }
    // Add data for each 'address'
    addresses.forEach((address, index) => {
        const row = [address, "Region", `https://example.com/image${index}.png`];
        let previousValue = 1000; // Start with a base value
        for (let year = startYear; year <= endYear; year++) {
            for (let month = 1; month <= 12; month++) {
                if ((year > startYear || (year === startYear && month >= startMonth)) && (year < endYear || (year === endYear && month <= endMonth))) {
                    // Increment the value by a random amount
                    const increment = Math.floor(Math.random() * (500 - 10 + 1)) + 10;
                    previousValue += increment;
                    // Convert the number to a string before pushing it to the row
                    row.push(previousValue.toString());
                }
            }
        }
        data.push(row);
    });
    return data;
}
export async function barChartRace() {
    // Example usage:
    const startYear = 2020;
    const startMonth = 1;
    const endYear = 2024;
    const endMonth = 1;
    const addresses = ["Address1", "Address2", "Address3"]; // Replace with real addresses
    const dummyData = createDummyBarChartRaceData(startYear, startMonth, endYear, endMonth, addresses);
    // Now you can write this data to a JSON file or use it directly
    console.log(JSON.stringify(dummyData, null, 2));
    await saveToJsonFile("../barChartRace.json", dummyData);
}
//# sourceMappingURL=BarChartRace.js.map