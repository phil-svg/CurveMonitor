import { Op } from 'sequelize';
import { TransactionCoins } from '../../../../models/TransactionCoins.js';
import { findCoinSymbolById } from '../../readFunctions/Coins.js';
import { WEB3_HTTP_PROVIDER, getTokenTransferEvents, getTxFromTxId } from '../../../web3Calls/generic.js';
import { getAbiBy } from '../../Abi.js';
import { Sandwiches } from '../../../../models/Sandwiches.js';
import { readSandwichesInBatches, readSandwichesInBatchesForBlock } from '../../readFunctions/Sandwiches.js';
import { calculateLossForDeposit, calculateLossForSwap, calculateLossForWithdraw } from './VictimLossFromSandwich.js';
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
    const COIN_TRANSFER_EVENTS = await getTokenTransferEvents(WEB3_HTTP_PROVIDER, coinID, parsedTx.block_number);
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
export async function saveSandwich(poolId, frontrunId, backrunId, extractedFromCurve, lossTransactions) {
    let lossInUsd = null;
    if (lossTransactions && lossTransactions.length > 0) {
        lossInUsd = lossTransactions.reduce((total, transaction) => total + (transaction.lossInUsd || 0), 0);
    }
    await Sandwiches.findOrCreate({
        where: { frontrun: frontrunId, backrun: backrunId },
        defaults: {
            pool_id: poolId,
            frontrun: frontrunId,
            backrun: backrunId,
            extracted_from_curve: extractedFromCurve,
            loss_transactions: lossTransactions,
        },
    });
}
export async function removeProcessedTransactions(transactions, sandwichFlags) {
    // Create a Set of all tx_ids that are marked as sandwiches or not sandwiches
    const flaggedTxIds = new Set();
    for (const flag of sandwichFlags) {
        flaggedTxIds.add(flag.tx_id);
    }
    // Filter out transactions that are flagged as sandwiches or not sandwiches
    return transactions.filter((transaction) => !flaggedTxIds.has(transaction.tx_id));
}
function isValidEthereumAddress(someString) {
    // Ethereum addresses are 42 characters long (including the '0x') and consist only of hexadecimal characters
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethereumAddressRegex.test(someString);
}
export async function addAddressesForLabeling() {
    try {
        const batches = await readSandwichesInBatches();
        await solveBatches(batches);
    }
    catch (error) {
        console.error(`Error reading sandwiches in batches: ${error}`);
    }
}
export async function addAddressesForLabelingForBlock(blockNumber) {
    try {
        const batches = await readSandwichesInBatchesForBlock(blockNumber);
        await solveBatches(batches);
    }
    catch (error) {
        console.error(`Error reading sandwiches in batches: ${error}`);
    }
}
async function solveBatches(batches) {
    if (!batches)
        return;
    for (const batch of batches) {
        for (const lossTx of batch) {
            const tx = await getTxFromTxId(lossTx.loss_transactions[0].tx_id);
            if (!tx) {
                console.log(`Could not retrieve transaction for tx_id: ${lossTx.loss_transactions[0].tx_id}`);
                continue;
            }
            if (typeof tx.to !== "string" || !isValidEthereumAddress(tx.to)) {
                console.log(`Invalid Ethereum address for tx_id: ${lossTx.loss_transactions[0].tx_id}`);
                continue;
            }
            await Sandwiches.update({ source_of_loss_contract_address: tx.to }, { where: { id: lossTx.id } });
        }
    }
}
//# sourceMappingURL=SandwichUtils.js.map