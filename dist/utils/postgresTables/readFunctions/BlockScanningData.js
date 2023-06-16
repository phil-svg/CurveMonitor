import { BlockScanningData } from "../../../models/BlockScanningData.js";
// Function to get the raw logs from block
export async function getRawLogsFromBlock() {
    const blockData = await BlockScanningData.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.fromBlockRawLogs) || null;
}
// Function to get the raw logs to block
export async function getRawLogsToBlock() {
    const blockData = await BlockScanningData.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.toBlockRawLogs) || null;
}
// Function to update the raw logs from block
export async function updateRawLogsFromBlock(fromBlock) {
    const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
    await blockData.update({ fromBlockRawLogs: fromBlock });
}
// Function to update the raw logs to block
export async function updateRawLogsToBlock(toBlock) {
    const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
    await blockData.update({ toBlockRawLogs: toBlock });
}
// Function to get the event parsing from block
export async function getEventParsingFromBlock() {
    const blockData = await BlockScanningData.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.fromBlockEventParsing) || null;
}
// Function to get the event parsing to block
export async function getEventParsingToBlock() {
    const blockData = await BlockScanningData.findOne();
    return (blockData === null || blockData === void 0 ? void 0 : blockData.toBlockEventParsing) || null;
}
// Function to update the event parsing from block
export async function updateEventParsingFromBlock(fromBlock) {
    const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
    await blockData.update({ fromBlockEventParsing: fromBlock });
}
// Function to update the event parsing to block
export async function updateEventParsingToBlock(toBlock) {
    const [blockData] = await BlockScanningData.findOrCreate({ where: {} });
    await blockData.update({ toBlockEventParsing: toBlock });
}
//# sourceMappingURL=BlockScanningData.js.map