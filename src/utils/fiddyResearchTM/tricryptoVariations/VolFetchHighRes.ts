import { getIdByAddress } from '../../postgresTables/readFunctions/Pools.js';
import { formatVolumeDataToJson, getTransactionVolume } from '../utils/Volume.js';
import { getBlockTimeStamp } from '../../web3Calls/generic.js';
import {
  fetchTransactionsForPoolAndTime,
  fetchTransactionsWithCoinsByTxIds,
  getTxHashByTxId,
} from '../../postgresTables/readFunctions/Transactions.js';
import { getSandwichContentForPoolAndTime } from '../../postgresTables/readFunctions/Sandwiches.js';
import { fetchAtomicArbsForPoolAndTime } from '../../postgresTables/readFunctions/AtomicArbs.js';
import { fetchCexDexArbTxIdsForPoolAndTime } from '../../postgresTables/readFunctions/CexDexArbs.js';
import ExcelJS from 'exceljs';

export async function saveJsonToExcel(jsonData: Record<string, number[]>, filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');

  // Add a header row dynamically based on the keys from the first object
  const headerRow = [
    'Date',
    'Minutely Volumes',
    'Sandwich Volumes',
    'Atomic Arb Volumes',
    'Cex Dex Arb Volumes',
    'Organic',
  ];
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

export async function generateVolumeReportForSinglePoolHighRes(
  poolAddress: string,
  startBlockNumber: number,
  endBlockNumber: number,
  startDate?: string,
  endDate?: string
) {
  const poolId = await getIdByAddress(poolAddress);
  if (!poolId) {
    console.log('could not find poolId for', poolAddress, 'in generateVolumeReportForSinglePool');
    return;
  }

  let startUnixTime: number | null;
  let endUnixTime: number | null;

  if (startDate && endDate) {
    startUnixTime = new Date(startDate).getTime() / 1000;
    endUnixTime = new Date(endDate).getTime() / 1000;
  } else {
    startUnixTime = await getBlockTimeStamp(startBlockNumber);
    endUnixTime = await getBlockTimeStamp(endBlockNumber);
  }
  if (!startUnixTime || !endUnixTime) return;

  const dailyVolumes = await calculateMinutelyVolumes(poolId, startUnixTime, endUnixTime);
  const sandwichDailyVolumes = await calculateMinutelySandwichVolumes(poolId, startUnixTime, endUnixTime);
  const dailyAtomicArbVolumes = await calculateMinutelyAtomicArbVolumes(poolId, startUnixTime, endUnixTime);
  const dailyCexDexArbVolumes = await calculateMinutelyCexDexArbVolumes(poolId, startUnixTime, endUnixTime);
  const resultJson = formatVolumeDataToJson(
    dailyVolumes,
    sandwichDailyVolumes,
    dailyAtomicArbVolumes,
    dailyCexDexArbVolumes
  );

  await saveJsonToExcel(resultJson, 'resultJson.xlsx');

  // const data = JSON.stringify(resultJson, null, 2); // Pretty print with 2 spaces
  // fs.writeFileSync("result.json", data, "utf8");

  console.log('Research step complete!');
}

export type MinutelyVolumes = {
  [minute: string]: number;
};

export async function calculateMinutelyVolumes(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<MinutelyVolumes> {
  const transactions = await fetchTransactionsForPoolAndTime(poolId, startUnixtime, endUnixtime);
  console.log(`there are ${transactions.length} transactions`);

  // Calculate the volume for each transaction
  const minutelyVolumes: MinutelyVolumes = {};
  for (const transaction of transactions) {
    const minute = new Date(transaction.block_unixtime * 1000).toISOString().slice(0, 16);

    minutelyVolumes[minute] = minutelyVolumes[minute] || 0;

    const valueToAdd = await getTransactionVolume(transaction.tx_id);
    minutelyVolumes[minute] += valueToAdd;
  }

  return minutelyVolumes;
}

export async function calculateMinutelySandwichVolumes(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<MinutelyVolumes> {
  const minutelyVolumes: MinutelyVolumes = {};

  const data = await getSandwichContentForPoolAndTime(poolId, startUnixtime, endUnixtime);
  console.log(`there are ${data.length} sandwiches`);

  for (const sandwich of data) {
    const frontrunVolume = await getTransactionVolume(sandwich.frontrun.tx_id);
    const backrunVolume = await getTransactionVolume(sandwich.backrun.tx_id);

    const totalVolume = Number(frontrunVolume) + Number(backrunVolume);

    const minute = new Date(sandwich.frontrun.block_unixtime * 1000).toISOString().slice(0, 16);
    minutelyVolumes[minute] = (Number(minutelyVolumes[minute]) || 0) + totalVolume;
  }

  return minutelyVolumes;
}

export async function calculateMinutelyAtomicArbVolumes(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<MinutelyVolumes> {
  const atomicTxIds = await fetchAtomicArbsForPoolAndTime(poolId, startUnixtime, endUnixtime);

  const transactions = await fetchTransactionsWithCoinsByTxIds(atomicTxIds);
  console.log(`there are ${transactions.length} atomic arbs`);

  const minutelyVolumes: MinutelyVolumes = {};

  for (const transaction of transactions) {
    const minute = new Date(transaction.block_unixtime * 1000).toISOString().slice(0, 16);

    minutelyVolumes[minute] = minutelyVolumes[minute] || 0;

    const valueToAdd = await getTransactionVolume(transaction.tx_id);
    minutelyVolumes[minute] += valueToAdd;
  }

  return minutelyVolumes;
}

export async function calculateMinutelyCexDexArbVolumes(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<MinutelyVolumes> {
  const arbTxIds = await fetchCexDexArbTxIdsForPoolAndTime(poolId, startUnixtime, endUnixtime);
  const transactions = await fetchTransactionsWithCoinsByTxIds(arbTxIds);
  console.log(`there are ${transactions.length} cex dex arbs`);

  const minutelyVolumes: MinutelyVolumes = {};

  for (const transaction of transactions) {
    const minute = new Date(transaction.block_unixtime * 1000).toISOString().slice(0, 16);
    minutelyVolumes[minute] = minutelyVolumes[minute] || 0;

    const valueToAdd = await getTransactionVolume(transaction.tx_id);
    minutelyVolumes[minute] += valueToAdd;
  }

  return minutelyVolumes;
}
