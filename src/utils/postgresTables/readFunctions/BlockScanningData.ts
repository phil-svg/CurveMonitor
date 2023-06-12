import { BlockScanningData } from "../../../models/BlockScanningData.js";

export async function readScannedBlockRangesRawLogs(): Promise<number[][] | "new table"> {
  return await readScannedBlockRanges("scannedBlockRangeRawLogs");
}

export async function readScannedBlockRangesEventParsing(): Promise<number[][] | "new table"> {
  return await readScannedBlockRanges("scannedBlockRangeEventParsing");
}

async function readScannedBlockRanges(rangeField: "scannedBlockRangeRawLogs" | "scannedBlockRangeEventParsing"): Promise<number[][] | "new table"> {
  const scannedBlocksData = await BlockScanningData.findByPk(1);

  if (!scannedBlocksData || !scannedBlocksData[rangeField]) {
    return "new table";
  }

  let storedBlockRanges: number[][] =
    scannedBlocksData[rangeField]?.map((range) => {
      const [start, end] = range.split("-").map(Number);
      return [start, end];
    }) || [];

  return storedBlockRanges;
}

export async function updateScannedBlocksRawLogs(blockRanges: number[][]): Promise<void> {
  await updateScannedBlockRanges("scannedBlockRangeRawLogs", blockRanges);
}

export async function updateScannedBlocksEventParsing(blockRanges: number[][]): Promise<void> {
  await updateScannedBlockRanges("scannedBlockRangeEventParsing", blockRanges);
}

async function updateScannedBlockRanges(rangeField: "scannedBlockRangeRawLogs" | "scannedBlockRangeEventParsing", blockRanges: number[][]): Promise<void> {
  const formattedBlockRanges = blockRanges.map((range) => `${range[0]}-${range[1]}`);

  const blockScanningData = await BlockScanningData.findByPk(1);

  if (!blockScanningData) {
    await BlockScanningData.create({
      [rangeField]: formattedBlockRanges,
    });
  } else {
    blockScanningData[rangeField] = formattedBlockRanges;
    await blockScanningData.save();
  }
}
