import { Op } from "sequelize";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { findCoinSymbolById } from "../readFunctions/Coins.js";
import { calculateLossForDeposit, calculateLossForSwap, calculateLossForWithdraw } from "./VictimLossFromSandwich.js";
import { getTokenTransferEvents } from "../../web3Calls/generic.js";
import { getAbiBy } from "../Abi.js";
import { Sandwiches } from "../../../models/Sandwiches.js";
export async function enrichCandidateWithCoinInfo(candidate) {
    // Extract tx_ids from candidate array
    const txIds = candidate.map((transaction) => transaction.tx_id);
    // Fetch corresponding TransactionCoins records
    const transactionCoinsRecords = await TransactionCoins.findAll({
        where: { tx_id: { [Op.in]: txIds } },
    });
    // Fetch coin symbols
    const coinSymbols = await Promise.all(transactionCoinsRecords.map((record) => findCoinSymbolById(record.coin_id)));
    // Add coin symbols to transactionCoins records
    const transactionCoinsRecordsWithSymbols = transactionCoinsRecords.map((record, index) => ({
        tx_id: record.tx_id,
        coin_id: record.coin_id,
        amount: record.amount,
        dollar_value: record.dollar_value,
        direction: record.direction,
        coin_symbol: coinSymbols[index],
    }));
    // Map updated TransactionCoins records by tx_id for easier lookup
    const transactionCoinsByTxIdWithSymbols = transactionCoinsRecordsWithSymbols.reduce((acc, record) => {
        if (acc[record.tx_id]) {
            acc[record.tx_id].push(record);
        }
        else {
            acc[record.tx_id] = [record];
        }
        return acc;
    }, {});
    // Add TransactionCoins data to candidate transactions
    const enrichedCandidate = candidate.map((transaction) => {
        var _a, _b;
        const transactionCoins = ((_b = transactionCoinsByTxIdWithSymbols[(_a = transaction.tx_id) !== null && _a !== void 0 ? _a : 0]) === null || _b === void 0 ? void 0 : _b.map((coin) => (Object.assign(Object.assign({}, coin), { amount: String(coin.amount), dollar_value: coin.dollar_value !== null ? String(coin.dollar_value) : null })))) || [];
        return Object.assign(Object.assign({}, transaction), { transactionCoins });
    });
    return enrichedCandidate;
}
export async function calcTheLossOfCurveUserFromSandwich(parsedTx) {
    if (parsedTx.transaction_type === "swap")
        return await calculateLossForSwap(parsedTx);
    if (parsedTx.transaction_type === "deposit")
        return await calculateLossForDeposit(parsedTx);
    if (parsedTx.transaction_type === "remove")
        return await calculateLossForWithdraw(parsedTx);
    return null;
}
export async function findMatchingTokenTransferAmout(coinID, parsedTx, amountHappyUser) {
    const COIN_TRANSFER_EVENTS = await getTokenTransferEvents(coinID, parsedTx.block_number);
    if (!Array.isArray(COIN_TRANSFER_EVENTS))
        return null;
    let amounts = COIN_TRANSFER_EVENTS.map((EVENT) => EVENT.returnValues.value / 1e18);
    let closest = amounts.reduce((prev, curr) => {
        return Math.abs(curr - amountHappyUser) < Math.abs(prev - amountHappyUser) ? curr : prev;
    });
    return closest;
}
export async function requiresDepositParam(pool_id) {
    const abi = await getAbiBy("AbisPools", { id: pool_id });
    const calcTokenAmountFunction = abi.find((method) => method.name === "calc_token_amount");
    if (!calcTokenAmountFunction) {
        throw new Error("calc_token_amount function not found in ABI");
    }
    // Check if the function requires 2 parameters
    const requiresSecondParam = calcTokenAmountFunction.inputs.length === 2;
    return requiresSecondParam;
}
export async function saveSandwich(frontrunId, backrunId, extractedFromCurve, lossTransactions) {
    await Sandwiches.findOrCreate({
        where: { frontrun: frontrunId, backrun: backrunId },
        defaults: {
            frontrun: frontrunId,
            backrun: backrunId,
            extracted_from_curve: extractedFromCurve,
            loss_transactions: lossTransactions,
        },
    });
}
export async function removeProcessedTransactions(transactions) {
    // Fetch all tx_ids in the sandwiches table
    const sandwiches = await Sandwiches.findAll({ attributes: ["frontrun", "backrun"] });
    const processedTxIds = sandwiches.reduce((result, sandwich) => {
        result.add(sandwich.frontrun);
        result.add(sandwich.backrun);
        return result;
    }, new Set());
    // Filter out transactions that already appear in the sandwiches table
    return transactions.filter((transaction) => !processedTxIds.has(transaction.tx_id));
}
//# sourceMappingURL=SandwichUtils.js.map