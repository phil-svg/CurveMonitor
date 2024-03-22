import { Op } from "sequelize";
import { Pool } from "../../../models/Pools.js";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { Transactions } from "../../../models/Transactions.js";
import { getTxIdsForPoolForGiven_Duration } from "../../helperFunctions/CrossQueries.js";
import ExcelJS from "exceljs";
import { priceTransactionFromTxId } from "../../TokenPrices/txValue/PriceTransaction.js";
import { convertDateToUnixTime } from "../../helperFunctions/QualityOfLifeStuff.js";
import { TransactionDetails } from "../../../models/TransactionDetails.js";
import { getPoolIdsByAddresses } from "../../postgresTables/readFunctions/Pools.js";
import { writeFileSync } from "fs";
import { getBlockNumberFromTxId } from "../../postgresTables/readFunctions/Transactions.js";
import { getTimestampByBlockNumber } from "../../postgresTables/readFunctions/Blocks.js";
export async function fetchSandwichUserLossForAllPoolsForTimePeriod(startDate, endDate) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    // Fetch sandwiches between the start and end Unix times
    const sandwiches = await Sandwiches.findAll({
        include: [
            {
                model: Transactions,
                as: "frontrunTransaction",
                where: {
                    block_unixtime: {
                        [Op.gte]: startUnixtime,
                        [Op.lt]: endUnixtime,
                    },
                },
                required: true,
            },
        ],
        order: [[{ model: Transactions, as: "frontrunTransaction" }, "block_unixtime", "DESC"]],
    });
    let totalLossInUsd = 0;
    // Iterate over each sandwich to sum up the lossInUsd from loss_transactions
    sandwiches.forEach((sandwich) => {
        if (sandwich.loss_transactions) {
            const lossTransactions = sandwich.loss_transactions;
            lossTransactions.forEach((loss) => {
                totalLossInUsd += loss.lossInUsd;
            });
        }
    });
    console.log("totalLossInUsd", totalLossInUsd);
    return totalLossInUsd;
}
export async function fetchSandwichUserLossForSomePoolsForTimePeriod(poolAddresses, startDate, endDate) {
    const startUnixtime = convertDateToUnixTime(startDate);
    const endUnixtime = convertDateToUnixTime(endDate);
    const poolIds = await getPoolIdsByAddresses(poolAddresses);
    // Fetch sandwiches for specified pool IDs between the start and end Unix times
    const sandwiches = await Sandwiches.findAll({
        where: {
            pool_id: {
                [Op.in]: poolIds, // Filter for provided pool IDs
            },
        },
        include: [
            {
                model: Transactions,
                as: "frontrunTransaction",
                where: {
                    block_unixtime: {
                        [Op.gte]: startUnixtime,
                        [Op.lt]: endUnixtime,
                    },
                },
                required: true,
            },
        ],
        order: [[{ model: Transactions, as: "frontrunTransaction" }, "block_unixtime", "DESC"]],
    });
    let totalLossInUsd = 0;
    let numberOfSandwichedCurveTx = 0;
    // Iterate over each sandwich to sum up the lossInUsd from loss_transactions
    sandwiches.forEach((sandwich) => {
        if (sandwich.loss_transactions) {
            numberOfSandwichedCurveTx++;
            const lossTransactions = sandwich.loss_transactions;
            lossTransactions.forEach((loss) => {
                totalLossInUsd += loss.lossInUsd;
            });
        }
    });
    console.log("Total loss in USD for selected pools", totalLossInUsd, "amongst", numberOfSandwichedCurveTx, "sandwiched curve-tx.");
    return totalLossInUsd;
}
export async function fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriod(poolAddress, startDate, endDate) {
    var _a, _b;
    // Convert start and end dates to Unix time
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    // Find the pool by address
    const pool = await Pool.findOne({
        where: { address: { [Op.iLike]: poolAddress.toLowerCase() } },
    });
    if (!pool) {
        throw new Error("Pool not found");
    }
    // Fetch sandwiches related to the specific pool and within the specified time period with loss_transactions
    const sandwiches = await Sandwiches.findAll({
        include: [
            {
                model: Transactions,
                as: "frontrunTransaction",
                include: [
                    {
                        model: TransactionDetails,
                        required: true,
                    },
                ],
                required: true,
            },
        ],
        where: {
            pool_id: pool.id,
            loss_transactions: { [Op.not]: null },
            "$frontrunTransaction.block_unixtime$": {
                [Op.gte]: startUnixTime,
                [Op.lt]: endUnixTime,
            },
        },
    });
    const botOccurrences = new Map();
    for (const sandwich of sandwiches) {
        const botAddress = (_b = (_a = sandwich.frontrunTransaction) === null || _a === void 0 ? void 0 : _a.transactionDetails) === null || _b === void 0 ? void 0 : _b.to;
        if (botAddress) {
            botOccurrences.set(botAddress, (botOccurrences.get(botAddress) || 0) + 1);
        }
    }
    console.log("botOccurrences", [...botOccurrences]);
    return botOccurrences;
}
export async function fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriodAndCalledContract(poolAddress, startDate, endDate, calledContract) {
    var _a, _b, _c;
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const calledContractLower = calledContract.toLowerCase();
    const pool = await Pool.findOne({
        where: { address: { [Op.iLike]: poolAddress.toLowerCase() } },
    });
    if (!pool)
        throw new Error("Pool not found");
    const sandwiches = await Sandwiches.findAll({
        where: {
            pool_id: pool.id,
            loss_transactions: { [Op.not]: null },
            "$frontrunTransaction.block_unixtime$": {
                [Op.gte]: startUnixTime,
                [Op.lt]: endUnixTime,
            },
        },
        include: [
            {
                model: Transactions,
                as: "frontrunTransaction",
                include: [
                    {
                        model: TransactionDetails,
                        required: true,
                    },
                ],
                required: true,
            },
        ],
    });
    const botOccurrences = new Map();
    for (const sandwich of sandwiches) {
        const lossTransactions = (_a = sandwich.loss_transactions) !== null && _a !== void 0 ? _a : [];
        for (const loss of lossTransactions) {
            // Perform the lookup for each loss transaction
            const transactionDetail = await TransactionDetails.findOne({
                where: { txId: loss.tx_id },
            });
            // Check if the 'to' address matches the calledContract, considering case sensitivity
            if (transactionDetail) {
                if (transactionDetail.to.toLowerCase().trim() === calledContractLower.trim()) {
                    // counts all sandwiches for input filters
                    // const botAddress = transactionDetail.to.toLowerCase();
                    // botOccurrences.set(botAddress, (botOccurrences.get(botAddress) || 0) + 1);
                    const botAddress = (_c = (_b = sandwich.frontrunTransaction) === null || _b === void 0 ? void 0 : _b.transactionDetails) === null || _c === void 0 ? void 0 : _c.to;
                    if (botAddress) {
                        botOccurrences.set(botAddress, (botOccurrences.get(botAddress) || 0) + 1);
                    }
                }
            }
        }
    }
    console.log("botOccurrences", botOccurrences);
    return botOccurrences;
}
export async function getSandwichTxIdsForGiven_Pool_Duration_VictimToContract(poolAddress, startDate, endDate, victimTo) {
    try {
        // Find the pool ID from the pool address
        const pool = await Pool.findOne({
            where: {
                address: {
                    [Op.iLike]: poolAddress,
                },
            },
        });
        if (!pool) {
            console.log(`Pool with address ${poolAddress} not found.`);
            return { victimTxIds: [], frontrunBackrunTxIds: [] };
        }
        // Convert the start and end dates to Unix timestamps
        const startUnix = convertDateToUnixTime(startDate);
        const endUnix = convertDateToUnixTime(endDate);
        // Find all sandwiches for the pool
        const sandwiches = await Sandwiches.findAll({
            where: {
                pool_id: pool.id,
                source_of_loss_contract_address: {
                    [Op.iLike]: victimTo,
                },
            },
        });
        const victimTxIds = [];
        const frontrunBackrunTxIds = [];
        for (const sandwich of sandwiches) {
            if (sandwich.loss_transactions) {
                for (const lossTx of sandwich.loss_transactions) {
                    const transaction = await Transactions.findByPk(lossTx.tx_id);
                    if (transaction && transaction.block_unixtime >= startUnix && transaction.block_unixtime <= endUnix) {
                        victimTxIds.push(lossTx.tx_id);
                        frontrunBackrunTxIds.push(sandwich.frontrun, sandwich.backrun);
                    }
                }
            }
        }
        return {
            victimTxIds: [...new Set(victimTxIds)],
            frontrunBackrunTxIds: [...new Set(frontrunBackrunTxIds)],
        };
    }
    catch (error) {
        console.error("Error fetching sandwich transaction IDs:", error);
        return { victimTxIds: [], frontrunBackrunTxIds: [] };
    }
}
export async function sandwichVictimTo_Plots(fullTxIds, sandwichTxIds, relatedTxIds, timeInterval, saveToExcelFlag = false) {
    let aggregatedData = { fullSet: {}, sandwichSet: {}, relatedSet: {} };
    const timeIntervalInSeconds = {
        "1h": 3600,
        "4h": 14400,
        daily: 86400,
        weekly: 604800,
        monthly: 2592000,
    };
    const intervalInSeconds = timeIntervalInSeconds[timeInterval];
    const txPriceMap = {};
    const aggregateTxIds = async (txIds, dataSet) => {
        for (const txId of txIds) {
            const transaction = await Transactions.findByPk(txId);
            if (transaction) {
                let dollarValue = txPriceMap[txId];
                if (dollarValue === undefined) {
                    dollarValue = await priceTransactionFromTxId(txId);
                    txPriceMap[txId] = dollarValue;
                }
                if (dollarValue !== null) {
                    const timeKey = Math.floor(transaction.block_unixtime / intervalInSeconds) * intervalInSeconds;
                    aggregatedData[dataSet][timeKey] = (aggregatedData[dataSet][timeKey] || 0) + Number(dollarValue.toFixed(0));
                }
            }
        }
    };
    await aggregateTxIds(fullTxIds, "fullSet");
    await aggregateTxIds(sandwichTxIds, "sandwichSet");
    await aggregateTxIds(relatedTxIds, "relatedSet");
    if (saveToExcelFlag) {
        await saveToExcel(aggregatedData);
    }
    return aggregatedData;
}
// Helper to convert Unix timestamp to Excel date format
function unixToExcelDate(unixTimestamp) {
    // Excel's date system starts on January 1, 1900.
    const excelStartDate = new Date(1900, 0, 1);
    const excelStartTimestamp = excelStartDate.getTime();
    // Excel mistakenly counts February 29, 1900, as a leap year, so we add 1.
    const excelLeapYearBugOffset = 1;
    // Convert milliseconds to days
    const millisecondsPerDay = 86400 * 1000;
    const daysSinceExcelStart = (unixTimestamp * 1000 - excelStartTimestamp) / millisecondsPerDay;
    // Adjust for the leap year bug and Excel's date system starting at 1
    return daysSinceExcelStart + excelLeapYearBugOffset + 2;
}
async function saveToExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    sheet.columns = [
        { header: "Time", key: "time", width: 20 },
        { header: "Full Set Volume", key: "fullSetVolume", width: 20 },
        { header: "Sandwich Set Volume", key: "sandwichSetVolume", width: 20 },
        { header: "Related Set Volume", key: "relatedSetVolume", width: 20 },
    ];
    // Combine and sort data based on the timestamps
    const combinedData = {};
    Object.entries(data.fullSet).forEach(([timestamp, volume]) => {
        combinedData[timestamp] = Object.assign(Object.assign({}, combinedData[timestamp]), { fullSetVolume: volume });
    });
    Object.entries(data.sandwichSet).forEach(([timestamp, volume]) => {
        combinedData[timestamp] = Object.assign(Object.assign({}, combinedData[timestamp]), { sandwichSetVolume: volume });
    });
    Object.entries(data.relatedSet).forEach(([timestamp, volume]) => {
        combinedData[timestamp] = Object.assign(Object.assign({}, combinedData[timestamp]), { relatedSetVolume: volume });
    });
    const sortedCombinedData = Object.entries(combinedData).sort(([a], [b]) => Number(a) - Number(b));
    // Add rows to sheet
    sortedCombinedData.forEach(([timestamp, volumes]) => {
        const excelDate = unixToExcelDate(Number(timestamp));
        sheet.addRow({
            time: excelDate,
            fullSetVolume: volumes.fullSetVolume || 0,
            sandwichSetVolume: volumes.sandwichSetVolume || 0,
            relatedSetVolume: volumes.relatedSetVolume || 0,
        });
    });
    // Format the 'time' column to display as date
    sheet.getColumn("time").numFmt = "mm/dd/yyyy";
    const fileName = "sandwichVictimToPlots.xlsx";
    await workbook.xlsx.writeFile(fileName);
    console.log(`Data saved to ${fileName}`);
}
export async function mosRequest_SandwichVolShareDueToMisconfigRouters() {
    const poolAddress = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const targetAddress = "0x22cE84A7F86662b78E49C6ec9E51D60FddE7b70A";
    const allTxIds = await getTxIdsForPoolForGiven_Duration(poolAddress, "2023-09-28", "2024-01-28");
    const foundSandwichTxIds = await getSandwichTxIdsForGiven_Pool_Duration_VictimToContract(poolAddress, "2023-09-28", "2024-01-28", targetAddress);
    await sandwichVictimTo_Plots(allTxIds, foundSandwichTxIds.victimTxIds, foundSandwichTxIds.frontrunBackrunTxIds, "daily", true);
    console.log("done");
}
// prints stats on user loss in usd, average, min, max, etc
export async function calculateLossStatistics() {
    try {
        const sandwiches = await Sandwiches.findAll({
            where: {
                loss_transactions: {
                    [Op.not]: null,
                },
            },
            attributes: ["loss_transactions"],
        });
        // Flatten all lossInUsd values into a single array
        const allLossesInUsd = sandwiches.flatMap((sandwich) => sandwich.loss_transactions.map((lossTx) => lossTx.lossInUsd));
        // Filter and print entries with lossInUsd above $100,000
        sandwiches.forEach((sandwich) => {
            sandwich.loss_transactions.forEach((lossTx) => {
                if (lossTx.lossInUsd > 600000) {
                    console.log(`High Loss Entry: ${JSON.stringify(lossTx)}`);
                }
            });
        });
        // Now calculate the statistics
        const averageLossInUsd = allLossesInUsd.reduce((acc, curr) => acc + curr, 0) / allLossesInUsd.length;
        const maxLossInUsd = Math.max(...allLossesInUsd);
        const minLossInUsd = Math.min(...allLossesInUsd);
        // For median, we need to sort the array
        const sortedLosses = [...allLossesInUsd].sort((a, b) => a - b);
        const mid = Math.floor(sortedLosses.length / 2);
        const medianLossInUsd = sortedLosses.length % 2 !== 0 ? sortedLosses[mid] : (sortedLosses[mid - 1] + sortedLosses[mid]) / 2;
        // For standard deviation
        const mean = averageLossInUsd;
        const squareDiffs = allLossesInUsd.map((value) => Math.pow(value - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((acc, curr) => acc + curr, 0) / squareDiffs.length;
        const stdDeviation = Math.sqrt(avgSquareDiff);
        console.log(`Average Loss in USD: ${averageLossInUsd}`);
        console.log(`Max Loss in USD: ${maxLossInUsd}`);
        console.log(`Min Loss in USD: ${minLossInUsd}`);
        console.log(`Median Loss in USD: ${medianLossInUsd}`);
        console.log(`Standard Deviation of Loss in USD: ${stdDeviation}`);
    }
    catch (error) {
        console.error("Failed to calculate loss statistics:", error);
    }
}
export async function createSandwichLossInUsdJsonFile() {
    try {
        // Fetch all rows where loss_transactions is not null
        const sandwiches = await Sandwiches.findAll({
            where: {
                loss_transactions: { [Op.not]: null },
            },
            attributes: ["loss_transactions"],
        });
        // Transform the data
        const lossInUsdArray = sandwiches.flatMap((sandwich) => sandwich.loss_transactions.map((lossTx) => lossTx.lossInUsd));
        // Prepare the data for the JSON file
        const jsonData = JSON.stringify(lossInUsdArray, null, 2);
        // Define the JSON file name and path
        const filePath = "./lossInUsdData.json";
        // Write to a JSON file
        writeFileSync(filePath, jsonData, "utf-8");
        console.log(`Data successfully written to ${filePath}`);
    }
    catch (error) {
        console.error("Failed to create JSON file:", error);
    }
}
export async function createSandwichLossInUsdJsonFileFor2023() {
    try {
        const sandwiches = await Sandwiches.findAll({
            where: {
                loss_transactions: { [Op.not]: null },
            },
            attributes: ["loss_transactions"],
        });
        let lossInUsdArrayFor2023 = [];
        // Sequentially process each sandwich to await asynchronous operations
        for (const sandwich of sandwiches) {
            for (const lossTx of sandwich.loss_transactions) {
                const blockNumber = await getBlockNumberFromTxId(lossTx.tx_id);
                if (blockNumber !== null) {
                    const timestamp = await getTimestampByBlockNumber(blockNumber);
                    if (timestamp !== null) {
                        const year = new Date(timestamp * 1000).getFullYear(); // Convert to milliseconds and get year
                        if (year === 2023) {
                            lossInUsdArrayFor2023.push(lossTx.lossInUsd);
                        }
                    }
                }
            }
        }
        // Prepare the data for the JSON file
        const jsonData = JSON.stringify(lossInUsdArrayFor2023, null, 2);
        // Define the JSON file name and path
        const filePath = "./lossInUsdData2023.json"; // Changed file name to reflect the year
        // Write to a JSON file
        writeFileSync(filePath, jsonData, "utf-8");
        console.log(`Data successfully written to ${filePath}`);
    }
    catch (error) {
        console.error("Failed to create JSON file for 2023:", error);
    }
}
//# sourceMappingURL=Sandwiches.js.map