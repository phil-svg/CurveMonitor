import { sequelize } from '../../../config/Database.js';
import { QueryTypes } from 'sequelize';
import * as fs from 'fs';

export async function getDailyTransactionCounts() {
  const query = `
    SELECT
      DATE(TO_TIMESTAMP(block_unixtime)) AS "transaction_date",
      COUNT(tx_id) AS "number_of_transactions"
    FROM
      transactions
    GROUP BY
      DATE(TO_TIMESTAMP(block_unixtime))
    ORDER BY
      DATE(TO_TIMESTAMP(block_unixtime)) ASC
  `;

  return sequelize.query(query, { type: QueryTypes.SELECT });
}

// Function to convert date format from YYYY-MM-DD to MM/DD/YYYY
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`; // Format more likely to be recognized by Excel
}

export async function dailyTxCount() {
  try {
    const data = await getDailyTransactionCounts();
    console.log('Daily Transaction Counts:', data);
    saveDataToCsvFile(data);
  } catch (error) {
    console.error('Error fetching daily transaction counts:', error);
  }
}

function saveDataToCsvFile(data: any[]) {
  const processedData = data
    .filter((entry) => entry.transaction_date) // Ensure date is not undefined
    .map((entry) => ({
      transaction_date: formatDate(entry.transaction_date),
      number_of_transactions: entry.number_of_transactions,
    }));

  // filter out transactions that are more than 12k
  //   const processedData = data
  //     .filter((entry) => entry.transaction_date && parseInt(entry.number_of_transactions, 10) <= 12000)
  //     .map((entry) => ({
  //       transaction_date: formatDate(entry.transaction_date),
  //       number_of_transactions: entry.number_of_transactions,
  //     }));

  const filePath = './transaction_counts.csv'; // Save as CSV
  const csvHeader = 'Transaction Date,Number of Transactions\n';
  const csvContent = processedData
    .map((entry) => `${entry.transaction_date},${entry.number_of_transactions}`)
    .join('\n');

  fs.writeFile(filePath, csvHeader + csvContent, (err) => {
    if (err) {
      console.error('Error writing CSV file:', err);
    } else {
      console.log('CSV data successfully saved to', filePath);
    }
  });
}
