import { Op } from "sequelize";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { findCoinSymbolById } from "../readFunctions/Coins.js";
export async function enrichCandidateWithCoinInfo(candidate) {
    // Extract tx_ids from candidate array
    const txIds = candidate.map((transaction) => transaction.tx_id);
    // Fetch corresponding TransactionCoins records
    const transactionCoinsRecords = await TransactionCoins.findAll({
        where: { tx_id: { [Op.in]: txIds } },
    });
    // Map TransactionCoins records by tx_id for easier lookup
    const transactionCoinsByTxId = transactionCoinsRecords.reduce((acc, record) => {
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
        var _a;
        return (Object.assign(Object.assign({}, transaction), { transactionCoins: transactionCoinsByTxId[(_a = transaction.tx_id) !== null && _a !== void 0 ? _a : 0] || [] }));
    });
    return enrichedCandidate;
}
export async function enrichCandidateWithSymbol(candidate) {
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
        var _a;
        return (Object.assign(Object.assign({}, transaction), { transactionCoins: transactionCoinsByTxIdWithSymbols[(_a = transaction.tx_id) !== null && _a !== void 0 ? _a : 0] || [] }));
    });
    return enrichedCandidate;
}
//# sourceMappingURL=SandwichHelper.js.map