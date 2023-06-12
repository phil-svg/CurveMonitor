import { BlockScanningData } from "../../../models/BlockScanningData.js";
export async function readScannedBlockRangesRawLogs() {
    return await readScannedBlockRanges("scannedBlockRangeRawLogs");
}
export async function readScannedBlockRangesEventParsing() {
    return await readScannedBlockRanges("scannedBlockRangeEventParsing");
}
async function readScannedBlockRanges(rangeField) {
    var _a;
    const scannedBlocksData = await BlockScanningData.findByPk(1);
    if (!scannedBlocksData || !scannedBlocksData[rangeField]) {
        return "new table";
    }
    let storedBlockRanges = ((_a = scannedBlocksData[rangeField]) === null || _a === void 0 ? void 0 : _a.map((range) => {
        const [start, end] = range.split("-").map(Number);
        return [start, end];
    })) || [];
    return storedBlockRanges;
}
export async function updateScannedBlocksRawLogs(blockRanges) {
    await updateScannedBlockRanges("scannedBlockRangeRawLogs", blockRanges);
}
export async function updateScannedBlocksEventParsing(blockRanges) {
    await updateScannedBlockRanges("scannedBlockRangeEventParsing", blockRanges);
}
async function updateScannedBlockRanges(rangeField, blockRanges) {
    const formattedBlockRanges = blockRanges.map((range) => `${range[0]}-${range[1]}`);
    const blockScanningData = await BlockScanningData.findByPk(1);
    if (!blockScanningData) {
        await BlockScanningData.create({
            [rangeField]: formattedBlockRanges,
        });
    }
    else {
        blockScanningData[rangeField] = formattedBlockRanges;
        await blockScanningData.save();
    }
}
//# sourceMappingURL=BlockScanningData.js.map