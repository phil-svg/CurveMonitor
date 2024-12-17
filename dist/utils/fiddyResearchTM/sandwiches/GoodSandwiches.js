import { Op } from 'sequelize';
import { Sandwiches } from '../../../models/Sandwiches.js';
import { Transactions } from '../../../models/Transactions.js';
import { fetchAllTransactionCoinData } from '../../postgresTables/readFunctions/TransactionCoins.js';
import { fetchTransactionPosition, fetchTxPositionByTxId, getTxHashByTxId, } from '../../postgresTables/readFunctions/Transactions.js';
import { IsSandwich } from '../../../models/IsSandwich.js';
import fs from 'fs';
import { getTransactionCostInUSD } from '../../postgresTables/mevDetection/atomic/utils/atomicArbDetection.js';
import { WEB3_HTTP_PROVIDER } from '../../web3Calls/generic.js';
export async function getSandwichLossInfoArrForAll() {
    const sandwiches = await Sandwiches.findAll({
        where: {
            loss_transactions: {
                [Op.not]: null,
            },
        },
    });
    const extendedLossTransactions = [];
    sandwiches.forEach((sandwich) => {
        if (sandwich.loss_transactions) {
            sandwich.loss_transactions.forEach((loss) => {
                extendedLossTransactions.push(Object.assign(Object.assign({}, loss), { poolId: sandwich.pool_id, frontrunTxId: sandwich.frontrun, backrunTxId: sandwich.backrun }));
            });
        }
    });
    return extendedLossTransactions;
}
async function getAllTxForSameBlockAndPoolWithoutTheSandwich(txId, poolId, excludedTxIds) {
    const transaction = await Transactions.findByPk(txId);
    if (!transaction) {
        console.log(`Transaction with ID ${txId} not found.`);
        return [];
    }
    const transactions = await Transactions.findAll({
        where: {
            block_number: transaction.block_number,
            pool_id: poolId,
            tx_id: {
                [Op.notIn]: excludedTxIds,
            },
        },
    });
    return transactions;
}
function simplifyTransactionCoinData(transactionCoinsData) {
    return transactionCoinsData.map((coin) => ({
        symbol: coin.coin.symbol,
        decimals: coin.coin.decimals,
        coinAddress: coin.coin.address,
        direction: coin.direction,
        amount: coin.amount,
        dollarValue: coin.dollar_value ? coin.dollar_value : 0, // Default to 0 if dollar_value is null
    }));
}
/**
 * Checks if a transaction is marked as a sandwich in the database.
 * @param txId The transaction ID to check.
 * @returns Promise<boolean> Returns true if the transaction is a sandwich, otherwise false.
 */
async function isTransactionSandwich(txId) {
    const sandwichRecord = await IsSandwich.findOne({
        where: {
            tx_id: txId,
        },
    });
    return sandwichRecord ? sandwichRecord.is_sandwich : false;
}
async function checkSingleSandwichForProfit(lossInfo) {
    const sandwichedTxSwap = await fetchAllTransactionCoinData(lossInfo.tx_id);
    if (sandwichedTxSwap.length <= 1)
        return;
    const simplifiedSandwichTxData = simplifyTransactionCoinData(sandwichedTxSwap);
    const transactionsInSameBlock = await getAllTxForSameBlockAndPoolWithoutTheSandwich(lossInfo.tx_id, lossInfo.poolId, [
        lossInfo.frontrunTxId,
        lossInfo.backrunTxId,
        lossInfo.tx_id,
    ]);
    // console.log('sandwichedTxSwap', sandwichedTxSwap[0].transaction.tx_id);
    // console.log('sandwichedTxSwap', sandwichedTxSwap[0].transaction.tx_hash);
    const wasSandwich = await isTransactionSandwich(sandwichedTxSwap[0].transaction.tx_id);
    if (!wasSandwich)
        return;
    for (const transaction of transactionsInSameBlock) {
        await checkSingleTx(transaction, simplifiedSandwichTxData, lossInfo, sandwichedTxSwap);
    }
}
function checkMatchingSymbolsAndDirections(simplifiedTxData, simplifiedSandwichTxData) {
    // Check if every coin in simplifiedTxData has a matching coin in simplifiedSandwichTxData
    const allMatchesFound = simplifiedTxData.every((txDataCoin) => {
        return simplifiedSandwichTxData.some((sandwichDataCoin) => txDataCoin.symbol === sandwichDataCoin.symbol && txDataCoin.direction === sandwichDataCoin.direction);
    });
    // Optionally, ensure the lengths match to avoid false positives
    // This prevents cases where simplifiedTxData might be a subset of simplifiedSandwichTxData
    const equalLengths = simplifiedTxData.length === simplifiedSandwichTxData.length;
    return allMatchesFound && equalLengths;
}
function findEntryByDirection(entries, direction) {
    return entries.find((entry) => entry.direction === direction);
}
function readDataFile() {
    const dataFilePath = '../sandwichData.json';
    if (!fs.existsSync(dataFilePath)) {
        return [];
    }
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
}
function writeDataFile(data) {
    const dataFilePath = '../sandwichData.json';
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}
export async function getBlockTransactionDetails(blockNumber, position) {
    try {
        const transaction = await WEB3_HTTP_PROVIDER.eth.getTransactionFromBlock(blockNumber, position);
        return transaction;
    }
    catch (error) {
        return null;
    }
}
async function getExtendedGasInfo(blockNumber, position) {
    try {
        const transaction = await getBlockTransactionDetails(blockNumber, position);
        return {
            gas: transaction.gas,
            gasPrice: transaction.gasPrice,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        };
    }
    catch (err) {
        console.log('gas failed');
        return null;
    }
}
async function checkSingleTx(transaction, simplifiedSandwichTxData, lossInfo, sandwichedTxSwap) {
    if (transaction.transaction_type !== 'swap')
        return;
    const positionCenter = sandwichedTxSwap[0].transaction.tx_position;
    const positionLater = transaction.tx_position;
    if (positionCenter === positionLater + 1)
        return;
    if (positionLater === positionCenter + 1)
        return;
    const txCoins = await fetchAllTransactionCoinData(transaction.tx_id);
    const simplifiedTxData = simplifyTransactionCoinData(txCoins);
    const match = checkMatchingSymbolsAndDirections(simplifiedTxData, simplifiedSandwichTxData);
    if (!match)
        return;
    const sandwichTxId = lossInfo.tx_id;
    const sandwichTxPosition = await fetchTxPositionByTxId(sandwichTxId);
    const otherTxPosition = transaction.tx_position;
    if (otherTxPosition < sandwichTxPosition)
        return;
    // console.log("sandwich", simplifiedSandwichTxData);
    // console.log("otherTx", simplifiedTxData);
    // reminder: out = SOLD, in = BOUGHT
    // idea: get exchangeRate of 2nd Trade, and apply to 1st Trade, and compare delta against userLossInCoinAmount
    const bought2ndTx = findEntryByDirection(simplifiedTxData, 'in');
    const sold2ndTx = findEntryByDirection(simplifiedTxData, 'out');
    const amountBought2ndTx = bought2ndTx.amount;
    const amountSold2ndTx = sold2ndTx.amount;
    const bought1stTx = findEntryByDirection(simplifiedSandwichTxData, 'in');
    const sold1stTx = findEntryByDirection(simplifiedSandwichTxData, 'out');
    const amountBoughtTx1 = bought1stTx.amount;
    const amountSoldTx1 = sold1stTx.amount;
    // I have 1 eth and get 1000 usdt
    // later in block I have 2 eth and get 1920 usdt
    // how much usdt would I have gotten later for 1 eth?
    // answer: 1eth * 1920/2
    const hyptoteticalAmountBoughtAfter2ndTrade = amountSoldTx1 * (amountBought2ndTx / amountSold2ndTx);
    const resultForSandwichedUserIfExchangeRateOfLaterTrade = hyptoteticalAmountBoughtAfter2ndTrade - amountBoughtTx1;
    // if this number is negative, it means the guy got less for the later exchange rate.
    if (resultForSandwichedUserIfExchangeRateOfLaterTrade < 0) {
        const txHashCenter = await getTxHashByTxId(sandwichedTxSwap[0].tx_id);
        const extendedGasInfoVictim = await getExtendedGasInfo(transaction.block_number, positionCenter);
        const extendedGasInfo2ndTx = await getExtendedGasInfo(transaction.block_number, positionLater);
        if (txHashCenter === transaction.tx_hash ||
            extendedGasInfoVictim.maxFeePerGas >= extendedGasInfo2ndTx.maxFeePerGas) {
            sandwichwasBadCounter++;
        }
        else {
            sandwichWasGoodCounter++;
            const frontrunTxId = lossInfo.frontrunTxId;
            const backrunTxId = lossInfo.backrunTxId;
            const txHashFrontrun = await getTxHashByTxId(frontrunTxId);
            const txHashBackrun = await getTxHashByTxId(backrunTxId);
            const txCoinsFrontrun = await fetchAllTransactionCoinData(frontrunTxId);
            const simplifiedTxDataFrontrun = simplifyTransactionCoinData(txCoinsFrontrun);
            const txCoinsBackrun = await fetchAllTransactionCoinData(backrunTxId);
            const simplifiedTxDataBackrun = simplifyTransactionCoinData(txCoinsBackrun);
            const gasCostInUSDFrontrun = await getTransactionCostInUSD(txHashFrontrun);
            const gasCostInUSDBackrun = await getTransactionCostInUSD(txHashBackrun);
            const gasCostInUSDSandwichCenter = await getTransactionCostInUSD(txHashCenter);
            const gasCostInUSDMatchLater = await getTransactionCostInUSD(transaction.tx_hash);
            const data = readDataFile();
            const entry = {
                txHashSandwich: txHashCenter,
                txHashMatchLater: transaction.tx_hash,
                sandwichSwapData: simplifiedSandwichTxData,
                swapDataLater: simplifiedTxData,
                differenceInAmountOut: resultForSandwichedUserIfExchangeRateOfLaterTrade * -1,
                unit: lossInfo.unit,
                frontrunTxHash: txHashFrontrun,
                frontrunSwapData: simplifiedTxDataFrontrun,
                backrunTxHash: txHashBackrun,
                backrunSwapData: simplifiedTxDataBackrun,
                gasCostInUSDFrontrun,
                gasCostInUSDBackrun,
                gasCostInUSDSandwichCenter,
                gasCostInUSDMatchLater,
                extendedGasInfoVictim,
                extendedGasInfo2ndTx,
            };
            data.push(entry);
            writeDataFile(data);
        }
    }
    else {
        sandwichwasBadCounter++;
    }
    console.log('');
    console.log('sandwichWasGoodCounter', sandwichWasGoodCounter);
    console.log('sandwichwasBadCounter', sandwichwasBadCounter);
}
let sandwichWasGoodCounter = 0;
let sandwichwasBadCounter = 0;
export async function profitableSandwichThings() {
    const sandwichLossInfoArrForAll = await getSandwichLossInfoArrForAll();
    let counter = 0;
    for (const singleSandwichLossInfo of sandwichLossInfoArrForAll) {
        /* example: {
          unit: 'cvxcrv-f',
          tx_id: 1842812,
          amount: 1.1249356816485943,
          lossInUsd: 1.269711032001665,
          unitAddress: '0x9D0464996170c6B9e75eED71c68B99dDEDf279e8',
          lossInPercentage: 0.11064927613338801,
          poolId: 66,
          frontrunTxId: 1842915,
          backrunTxId: 1842918
        } */
        counter++;
        // if (counter < 11868) continue;
        await checkSingleSandwichForProfit(singleSandwichLossInfo);
        if (counter % 250 === 0) {
            console.log(counter, sandwichLossInfoArrForAll.length);
        }
    }
    console.log('Went through', sandwichLossInfoArrForAll.length, 'Curve User Loss Sandwiches.');
}
async function solveSingleSandwich(simplifiedSandwichTxData, lossInfo, sandwichedTxSwap) {
    const transaction = await Transactions.findByPk(lossInfo.tx_id);
    if (!transaction) {
        console.log('Transaction not found');
        return;
    }
    const positionCenter = sandwichedTxSwap[0].transaction.tx_position;
    const frontrunTxId = lossInfo.frontrunTxId;
    const backrunTxId = lossInfo.backrunTxId;
    const txHashCenter = await getTxHashByTxId(sandwichedTxSwap[0].tx_id);
    const extendedGasInfoVictim = await getExtendedGasInfo(transaction.block_number, positionCenter);
    if (!extendedGasInfoVictim) {
        console.log('Extended gas info for victim not found');
        return;
    }
    const positionFrontrun = await fetchTransactionPosition(frontrunTxId);
    if (positionFrontrun !== 0 && !positionFrontrun) {
        console.log('Frontrun transaction position not found', frontrunTxId);
        return;
    }
    const extendedGasInfoFrontrun = await getExtendedGasInfo(transaction.block_number, positionFrontrun);
    if (!extendedGasInfoFrontrun) {
        console.log('Extended gas info for frontrun not found');
        return;
    }
    const positionBackrun = await fetchTransactionPosition(backrunTxId);
    if (!positionBackrun) {
        console.log('Backrun transaction position not found');
        return;
    }
    const extendedGasInfoBackrun = await getExtendedGasInfo(transaction.block_number, positionBackrun);
    if (!extendedGasInfoBackrun) {
        console.log('Extended gas info for backrun not found');
        return;
    }
    const txHashFrontrun = await getTxHashByTxId(frontrunTxId);
    const txHashBackrun = await getTxHashByTxId(backrunTxId);
    const txCoinsFrontrun = await fetchAllTransactionCoinData(frontrunTxId);
    const simplifiedTxDataFrontrun = simplifyTransactionCoinData(txCoinsFrontrun);
    const txCoinsBackrun = await fetchAllTransactionCoinData(backrunTxId);
    const simplifiedTxDataBackrun = simplifyTransactionCoinData(txCoinsBackrun);
    const gasCostInUSDFrontrun = await getTransactionCostInUSD(txHashFrontrun);
    const gasCostInUSDBackrun = await getTransactionCostInUSD(txHashBackrun);
    const gasCostInUSDSandwichCenter = await getTransactionCostInUSD(txHashCenter);
    const data = readDataFile();
    const entry = {
        txHashSandwich: txHashCenter,
        sandwichSwapData: simplifiedSandwichTxData,
        frontrunTxHash: txHashFrontrun,
        frontrunSwapData: simplifiedTxDataFrontrun,
        backrunTxHash: txHashBackrun,
        backrunSwapData: simplifiedTxDataBackrun,
        gasCostInUSDFrontrun,
        gasCostInUSDBackrun,
        gasCostInUSDSandwichCenter,
        extendedGasInfoVictim,
        extendedGasInfoFrontrun,
        extendedGasInfoBackrun,
    };
    data.push(entry);
    writeDataFile(data);
}
function chunkArray(arr, chunkSize) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}
export async function checkSingleSandwichForJson(lossInfo) {
    if (lossInfo.frontrunTxId === 3309906) {
        console.log('lossInfo', lossInfo);
    }
    const allTransactionCoinData = await fetchAllTransactionCoinData(lossInfo.tx_id);
    const simplifiedSandwichTxData = simplifyTransactionCoinData(allTransactionCoinData);
    await solveSingleSandwich(simplifiedSandwichTxData, lossInfo, allTransactionCoinData);
}
export async function fullSandwichJson() {
    console.time('full');
    const sandwichLossInfoArrForAll = await getSandwichLossInfoArrForAll(); // found 18648 entries
    const chunkSize = 25; // Number of tasks to run in parallel
    const chunks = chunkArray(sandwichLossInfoArrForAll, chunkSize);
    let counter = 0;
    // Process each chunk sequentially, but process eachlossInfo chunk in parallel
    for (const chunk of chunks) {
        console.time('check');
        // Run the tasks in this chunk in parallel
        await Promise.all(chunk.map(async (singleSandwichLossInfo) => {
            counter++;
            await checkSingleSandwichForJson(singleSandwichLossInfo);
            // console.log(counter, sandwichLossInfoArrForAll.length);
        }));
        console.timeEnd('check');
    }
    console.log('Went through', sandwichLossInfoArrForAll.length, 'Curve User Loss Sandwiches.');
    console.log('finished');
    console.timeEnd('full');
    // const data = readDataFile();
    // console.log(data.length);
}
//# sourceMappingURL=GoodSandwiches.js.map