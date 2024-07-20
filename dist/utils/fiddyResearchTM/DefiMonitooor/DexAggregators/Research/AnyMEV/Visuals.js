import fs from 'fs';
import moment from 'moment';
import { parse } from 'json2csv';
/**
 * Saves the hourly volume data to a CSV file.
 * @param hourlyData Array of hourly volume data.
 * @param filePath Path to save the CSV file.
 */
export function saveHourlyDataToCsvForVisuals(hourlyData, filePath) {
    return new Promise((resolve, reject) => {
        // Start with the CSV header
        let csvContent = 'Date,Total CEX/DEX Volume,Total Volume\n';
        // Convert each entry in the hourly data to a CSV formatted string
        hourlyData.forEach(({ hour, totalCexDexVolume, totalVolume }) => {
            const formattedDate = moment(hour, 'YYYY-MM-DD HH:00').format('MM/DD/YYYY HH:mm'); // Excel-friendly date format
            csvContent += `${formattedDate},${Math.round(totalCexDexVolume)},${Math.round(totalVolume)}\n`;
        });
        // Write the CSV content to a file
        fs.writeFile(filePath, csvContent, 'utf8', (err) => {
            if (err) {
                console.error('Failed to write CSV file:', err);
                reject(err);
            }
            else {
                console.log('CSV file has been saved successfully to:', filePath);
                resolve();
            }
        });
    });
}
export async function loadAndCalculateHourlyVolumes(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const transactions = JSON.parse(rawData);
        const hourlyVolumes = {};
        transactions.forEach((transaction) => {
            const hourKey = moment.unix(transaction.unixTimestamp).format('YYYY-MM-DD HH:00');
            if (!hourlyVolumes[hourKey]) {
                hourlyVolumes[hourKey] = { totalCexDexVolume: 0, totalVolume: 0 };
            }
            hourlyVolumes[hourKey].totalCexDexVolume += transaction.volInUsdCexDexArb;
            hourlyVolumes[hourKey].totalVolume += transaction.volInUsd;
        });
        // Convert the hourly volumes object into an array
        return Object.entries(hourlyVolumes)
            .map(([hour, volumes]) => ({
            hour,
            totalCexDexVolume: volumes.totalCexDexVolume,
            totalVolume: volumes.totalVolume,
        }))
            .sort((a, b) => a.hour.localeCompare(b.hour)); // Sort by hour for easier reading
    }
    catch (error) {
        console.error('Error processing the JSON file:', error);
        return [];
    }
}
/**
 * Aggregates volumes by "to" address and saves them to a JSON file.
 * @param transactions Array of transaction analysis results.
 * @param filePath Path where the JSON file should be saved.
 */
export async function aggregateAndSaveVolumesByToAddress(filePathToOpen, filePathToSave) {
    const rawData = fs.readFileSync(filePathToOpen, 'utf8');
    const transactions = JSON.parse(rawData);
    const volumeByAddress = {};
    // Aggregate volumes by "to" address
    transactions.forEach((transaction) => {
        const address = transaction.to.toLowerCase(); // Normalize address to lowercase
        if (volumeByAddress[address]) {
            volumeByAddress[address] += transaction.volInUsd;
        }
        else {
            volumeByAddress[address] = transaction.volInUsd;
        }
    });
    // Convert to array and sort by total volume in ascending order
    const sortedVolumes = Object.entries(volumeByAddress)
        .map(([address, totalVolume]) => ({
        address,
        totalVolume: Math.round(totalVolume), // Round volumes to the nearest whole number
    }))
        .sort((a, b) => a.totalVolume - b.totalVolume);
    // Save to JSON file
    fs.writeFile(filePathToSave, JSON.stringify(sortedVolumes, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Failed to write to JSON file:', err);
            return;
        }
        console.log('Volume data saved to JSON file:', filePathToSave);
    });
}
/**
 * Filters transactions by a specified "to" address and saves them to a CSV file.
 * @param filePathToOpen Path to the JSON file containing transaction data.
 * @param filePathToSave Path where the CSV file should be saved.
 * @param address The "to" address to filter by, case insensitive.
 */
export async function filterAndSaveTransactionsByToAddress(filePathToOpen, filePathToSave, address) {
    const rawData = fs.readFileSync(filePathToOpen, 'utf8');
    const transactions = JSON.parse(rawData);
    // Filter transactions where "to" address matches the specified address, case insensitive
    const filteredTransactions = transactions.filter((transaction) => transaction.to.toLowerCase() === address.toLowerCase());
    // Convert to CSV
    const fields = ['txHash', 'from', 'to', 'blockNumber', 'unixTimestamp', 'volInUsdCexDexArb'];
    const opts = { fields };
    try {
        const csv = parse(filteredTransactions, opts);
        fs.writeFileSync(filePathToSave, csv, 'utf8');
        console.log('CSV file has been saved:', filePathToSave);
    }
    catch (err) {
        console.error('Failed to write to CSV file:', err);
    }
}
//# sourceMappingURL=Visuals.js.map