import fs from 'fs';
import { TransactionAnalysisResult } from './AnyAddressMev.js';

export function writeTransactionsToCSV(results: TransactionAnalysisResult[], filePath: string): void {
  // Updated CSV header with new fields and 'Date' instead of 'unixTimestamp'
  const header = 'txHash,Date,volInUsd,isAtomicArb,isCexDexArb,volInUsdCexDexArb,volInUsdAtomicArb\n';
  let csvContent = header;

  // Process each result and append to CSV content
  results.forEach((result) => {
    const { txHash, unixTimestamp, volInUsd, isAtomicArb, isCexDexArb, volInUsdCexDexArb, volInUsdAtomicArb } = result;

    // Convert Unix timestamp to Excel-friendly date format (e.g., MM/DD/YYYY)
    const date = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
    // const formattedDate = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; // Formats to YYYY-MM-DD
    const formattedDate = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`; // Formats to YYYY-MM-DD HH:mm

    const atomicArbStr = isAtomicArb ? 'TRUE' : 'FALSE';
    const cexDexArbStr = isCexDexArb ? 'TRUE' : 'FALSE';

    // Append a formatted line to the CSV content
    csvContent += `${txHash},${formattedDate},${Number(volInUsd.toFixed(0))},${atomicArbStr},${cexDexArbStr},${Number(volInUsdCexDexArb.toFixed(0))},${Number(volInUsdAtomicArb.toFixed(0))}\n`;
  });

  // Write to a CSV file
  fs.writeFile(filePath, csvContent, 'utf8', (err) => {
    if (err) {
      console.error('An error occurred while writing to the CSV file:', err);
    } else {
      console.log('CSV file has been saved successfully.');
    }
  });
}

export interface VolumeDictionary {
  [key: string]: number;
}

// Function to save the dictionary to JSON, sort by value, and format numbers
export function saveVolumeDictionaryToJsonFile(data: VolumeDictionary, fileName: string): void {
  // Create an array from the dictionary, sort it by volume ascending
  const sortedData = Object.entries(data)
    .map(([key, value]) => ({ key, value: Number(value.toFixed(0)) })) // Format numbers with no decimal places
    .sort((a, b) => a.value - b.value); // Sort by value low to high

  // Convert the sorted array back to an object
  const sortedObject: VolumeDictionary = {};
  sortedData.forEach((item) => {
    sortedObject[item.key] = item.value;
  });

  // Write to a JSON file
  fs.writeFile(fileName, JSON.stringify(sortedObject, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to write to JSON file:', err);
    } else {
      console.log(fileName + ' has been saved.');
    }
  });
}

/**
 * Saves an array of transaction analysis results to a JSON file, sorted by block number.
 * @param results Array of transaction analysis results.
 * @param filePath Path to the JSON file where results should be saved.
 */
export function saveResultsToJsonFile(results: TransactionAnalysisResult[], filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Sort results by block number in ascending order
    results.sort((a, b) => a.blockNumber - b.blockNumber);

    const jsonData = JSON.stringify(results, null, 2); // Indent with 2 spaces for readability

    fs.writeFile(filePath, jsonData, 'utf8', (err) => {
      if (err) {
        console.error('Failed to write to JSON file:', err);
        reject(err);
      } else {
        console.log('JSON file has been saved successfully to:', filePath);
        resolve();
      }
    });
  });
}
