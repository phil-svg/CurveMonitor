import { BlockScanningData } from "../../../models/BlockScanningData.js";

// Function to get the raw logs from block
export async function getRawLogsFromBlock(): Promise<number | null> {
  const blockData = await BlockScanningData.findOne();
  return blockData?.fromBlockRawLogs || null;
}

// Function to get the raw logs to block
export async function getRawLogsToBlock(): Promise<number | null> {
  const blockData = await BlockScanningData.findOne();
  return blockData?.toBlockRawLogs || null;
}

// Function to update the raw logs from block
export async function updateRawLogsFromBlock(fromBlock: number): Promise<void> {
  const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
  await blockData.update({ fromBlockRawLogs: fromBlock });
}

// Function to update the raw logs to block
export async function updateRawLogsToBlock(toBlock: number): Promise<void> {
  const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
  await blockData.update({ toBlockRawLogs: toBlock });
}

// Function to get the event parsing from block
export async function getEventParsingFromBlock(): Promise<number | null> {
  const blockData = await BlockScanningData.findOne();
  return blockData?.fromBlockEventParsing || null;
}

// Function to get the event parsing to block
export async function getEventParsingToBlock(): Promise<number | null> {
  const blockData = await BlockScanningData.findOne();
  return blockData?.toBlockEventParsing || null;
}

// Function to update the event parsing from block
export async function updateEventParsingFromBlock(fromBlock: number): Promise<void> {
  const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
  await blockData.update({ fromBlockEventParsing: fromBlock });
}

// Function to update the event parsing to block
export async function updateEventParsingToBlock(toBlock: number): Promise<void> {
  const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
  await blockData.update({ toBlockEventParsing: toBlock });
}
