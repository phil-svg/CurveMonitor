import { Op } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { Transactions } from "../../../models/Transactions.js";
import { fetchAllTransactionCoinData } from "../../postgresTables/readFunctions/TransactionCoins.js";
import { fetchTxPositionByTxId, getTxHashByTxId } from "../../postgresTables/readFunctions/Transactions.js";
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
        symbol: coin.coin.dataValues.symbol,
        direction: coin.direction,
        amount: coin.amount,
        dollarValue: coin.dollar_value ? coin.dollar_value : 0,
    }));
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
async function checkSingleTx(transaction, simplifiedSandwichTxData, lossInfo, sandwichedTxSwap) {
    if (transaction.transaction_type !== "swap")
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
    const bought2ndTx = findEntryByDirection(simplifiedTxData, "in");
    const sold2ndTx = findEntryByDirection(simplifiedTxData, "out");
    const amountBought2ndTx = bought2ndTx.amount;
    const amountSold2ndTx = sold2ndTx.amount;
    const bought1srTx = findEntryByDirection(simplifiedSandwichTxData, "in");
    const sold1stTx = findEntryByDirection(simplifiedSandwichTxData, "out");
    const amountBoughtTx1 = bought1srTx.amount;
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
        if (txHashCenter === transaction.tx_hash) {
            sandwichwasBadCounter++;
        }
        else {
            sandwichWasGoodCounter++;
            console.log("");
            console.log("txHashCenter", txHashCenter);
            console.log("later transaction", transaction.tx_hash);
            console.log("sandwich", simplifiedSandwichTxData);
            console.log("otherTx", simplifiedTxData);
            console.log("discount in $ cause of sammich:", resultForSandwichedUserIfExchangeRateOfLaterTrade * -1, lossInfo.unit);
        }
    }
    else {
        sandwichwasBadCounter++;
    }
    console.log("");
    console.log("sandwichWasGoodCounter", sandwichWasGoodCounter);
    console.log("sandwichwasBadCounter", sandwichwasBadCounter);
}
let sandwichWasGoodCounter = 0;
let sandwichwasBadCounter = 0;
export async function profitableSandwichThings() {
    const sandwichLossInfoArrForAll = await getSandwichLossInfoArrForAll();
    let counter = 0;
    for (const singleSandwichLossInfo of sandwichLossInfoArrForAll) {
        counter++;
        // if (counter < 11868) continue;
        await checkSingleSandwichForProfit(singleSandwichLossInfo);
        console.log(counter, sandwichLossInfoArrForAll.length);
    }
    console.log("Went through", sandwichLossInfoArrForAll.length, "Curve User Loss Sandwiches.");
}
//# sourceMappingURL=GoodSandwiches.js.map