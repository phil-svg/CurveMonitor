import ExcelJS from "exceljs";
import { CexDexArbs } from "../../../models/CexDexArbs.js";
import { Pool } from "../../../models/Pools.js";
import { fn, col } from "sequelize";
export async function printCexDexPoolDistribution() {
    // Step 1: Query and Count CexDexArbs
    const arbsCount = await CexDexArbs.findAll({
        attributes: [
            "pool_id",
            [fn("COUNT", col("pool_id")), "count"], // Count occurrences of each pool_id
        ],
        group: "pool_id",
        raw: true,
    });
    // Step 2: Fetch Pool Details
    const poolDetails = await Promise.all(arbsCount.map(async (item) => {
        const pool = await Pool.findByPk(item.pool_id);
        return {
            poolId: item.pool_id,
            count: item.count,
            name: (pool === null || pool === void 0 ? void 0 : pool.name) || "Unknown",
            address: (pool === null || pool === void 0 ? void 0 : pool.address) || "Unknown",
        };
    }));
    // Step 3: Sort Data
    const sortedPoolDetails = poolDetails.sort((a, b) => b.count - a.count);
    // Step 4: Write to Excel File
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("CexDexArbs Report");
    // Define columns
    worksheet.columns = [
        { header: "Pool ID", key: "poolId", width: 10 },
        { header: "Count", key: "count", width: 10 },
        { header: "Name", key: "name", width: 30 },
        { header: "Address", key: "address", width: 50 },
    ];
    // Add rows
    worksheet.addRows(sortedPoolDetails);
    // Save the Excel file
    await workbook.xlsx.writeFile("CexDexArbsReport.xlsx");
    console.log("Excel report generated.");
}
//# sourceMappingURL=PoolDistribution.js.map