import { CoWProtocolGPv2Settlement, ETH_ADDRESS, WETH_ADDRESS } from "../../../../helperFunctions/Constants.js";
import { getGasUsedFromReceipt } from "../../../readFunctions/Receipts.js";
import { extractGasPrice, getTransactionDetailsByTxHash } from "../../../readFunctions/TransactionDetails.js";
import { Transactions } from "../../../../../models/Transactions.js";
import { Op } from "sequelize";
import { getHistoricalTokenPriceFromDefiLlama } from "../../txValue/DefiLlama.js";
import { isActuallyBackrun } from "../../../readFunctions/Sandwiches.js";
export function filterTransfersByAddress(cleanedTransfers, to) {
    return cleanedTransfers.filter((transfer) => transfer.from.toLowerCase() === to.toLowerCase() || transfer.to.toLowerCase() === to.toLowerCase());
}
export function translateWETHToETHInTransfers(cleanedTransfers) {
    return cleanedTransfers.map((transfer) => {
        if (transfer.tokenSymbol === "WETH") {
            return Object.assign(Object.assign({}, transfer), { tokenSymbol: "ETH", tokenAddress: ETH_ADDRESS });
        }
        return transfer;
    });
}
export async function getBalanceChangeForAddressFromTransfers(walletAddress, cleanedTransfers) {
    const balances = {};
    const translatedTransfers = translateWETHToETHInTransfers(cleanedTransfers);
    translatedTransfers.forEach((transfer) => {
        // If the address is involved in the transaction
        if (transfer.from.toLowerCase() === walletAddress.toLowerCase() || transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
            const address = transfer.tokenAddress;
            const symbol = transfer.tokenSymbol || "Unknown Token";
            if (!balances[address]) {
                balances[address] = { symbol: symbol, amount: 0 };
            }
            if (transfer.from.toLowerCase() === walletAddress.toLowerCase()) {
                balances[address].amount -= transfer.parsedAmount;
            }
            if (transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
                balances[address].amount += transfer.parsedAmount;
            }
        }
    });
    // Filter out values smaller than 1e-7 in magnitude and map to BalanceChange array
    const filteredBalances = Object.keys(balances)
        .filter((token) => Math.abs(balances[token].amount) >= 1e-7)
        .map((token) => ({
        tokenAddress: token,
        balanceChange: balances[token].amount,
        tokenSymbol: balances[token].symbol,
    }));
    return filteredBalances;
}
/**
 * Merges multiple BalanceChanges objects into a single BalanceChanges.
 *
 * @param ...balanceChanges - The BalanceChanges objects to be merged.
 * @returns A merged BalanceChanges.
 */
function mergeBalanceChanges(...balanceChanges) {
    const merged = {};
    // Iterate over each BalanceChanges
    balanceChanges.forEach((bc) => {
        // Iterate over each address in the BalanceChanges
        for (const address in bc) {
            // If the address is already in the merged result
            if (merged.hasOwnProperty(address)) {
                merged[address].amount += bc[address].amount;
            }
            else {
                merged[address] = Object.assign({}, bc[address]);
            }
        }
    });
    // Remove entries with 0 amount
    for (const address in merged) {
        if (merged[address].amount === 0) {
            delete merged[address];
        }
    }
    return merged;
}
const calculateBalanceChangesForMints = (liquidityPairs, calledContractAddress) => {
    let balanceChange = {};
    const calledAddressLower = calledContractAddress.toLowerCase();
    liquidityPairs.forEach((pair) => {
        pair.forEach((mint, index) => {
            const address = mint.tokenAddress;
            const symbol = mint.tokenSymbol || "Unknown Token";
            if (!balanceChange[address]) {
                balanceChange[address] = { symbol: symbol, amount: 0 };
            }
            if (index === 0 && mint.from.toLowerCase() === calledAddressLower) {
                // Deduct the token used for minting
                balanceChange[address].amount -= mint.parsedAmount;
            }
            else if (index === 1 && mint.to.toLowerCase() === calledAddressLower) {
                // Add the minted token to the balance
                balanceChange[address].amount += mint.parsedAmount;
            }
        });
    });
    return balanceChange;
};
/**
 * all balance changes are positive
 * or
 * if outflowing eth, all other balance changes (of which there has to be at least one) are postive
 * and
 * there were balance changes at all
 * and
 * ETH leaf (bribe)
 * @param cleanedTransfers a sorted list of all decoded token transfers for a given tx
 * @param balanceChanges token balance changes for "from" and "to" (bot and bot operator)
 * @param from the address which called the bot
 * @param to the bots' address
 * @returns
 */
function isAtomicArbCaseValueStaysWithFromOrTo(cleanedTransfers, balanceChangesFrom, balanceChangesTo, from, to) {
    if (balanceChangesFrom.length === 0 && balanceChangesTo.length === 0)
        return false;
    let hasNegativeEthChangeFrom = false;
    let hasNegativeEthChangeTo = false;
    let hasNonEthNegativeChange = false;
    let hasPositiveChangeInFrom = false;
    let hasPositiveChangeInTo = false;
    for (const change of balanceChangesFrom) {
        if (change.tokenSymbol === "ETH" && change.balanceChange < 0) {
            hasNegativeEthChangeFrom = true;
            break;
        }
        else if (change.balanceChange < 0) {
            hasNonEthNegativeChange = true;
            break;
        }
        else if (change.balanceChange > 0) {
            hasPositiveChangeInFrom = true;
        }
    }
    for (const change of balanceChangesTo) {
        if (change.tokenSymbol === "ETH" && change.balanceChange < 0) {
            hasNegativeEthChangeTo = true;
        }
        else if (change.balanceChange < 0) {
            hasNonEthNegativeChange = true;
            break;
        }
        else if (change.balanceChange > 0) {
            hasPositiveChangeInTo = true;
        }
    }
    if (hasNegativeEthChangeFrom)
        return false;
    if (hasPositiveChangeInFrom && hasPositiveChangeInTo)
        return false;
    if (hasNonEthNegativeChange)
        return false;
    // Filter out ETH transfers
    const ethTransfers = cleanedTransfers.filter((transfer) => transfer.tokenSymbol === "ETH");
    // Filter leafs which receive ETH
    const leafReceivers = ethTransfers.filter((ethTransfer) => {
        return cleanedTransfers.some((transfer) => {
            return transfer.from.toLowerCase() === ethTransfer.to.toLowerCase() || transfer.to.toLowerCase() === ethTransfer.to.toLowerCase();
        });
    });
    // Check if any of these leaf addresses are NOT either "from" or "to".
    const hasValidLeaf = leafReceivers.some((leafReceiver) => {
        return leafReceiver.to.toLowerCase() !== from.toLowerCase() && leafReceiver.to.toLowerCase() !== to.toLowerCase();
    });
    // If no valid leaf address is found, return false.
    if (!hasValidLeaf && balanceChangesTo.length === 0)
        return false;
    if (hasNegativeEthChangeTo) {
        return hasPositiveChangeInFrom || hasPositiveChangeInTo;
    }
    return true;
}
// New check for the case where value goes outside "from" and "to".
function isAtomicArbCaseValueGoesOutsideFromOrTo(cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to) {
    // Check that from and to have no balance changes
    if (balanceChangeFrom.length !== 0 || balanceChangeTo.length !== 0) {
        return false;
    }
    // Start from the last transfer and move towards the start of the array
    for (let i = cleanedTransfers.length - 1; i >= 0; i--) {
        let transfer = cleanedTransfers[i];
        if ((transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase()) &&
            transfer.to.toLowerCase() !== from.toLowerCase() &&
            transfer.to.toLowerCase() !== to.toLowerCase()) {
            return true; // Found a transfer where value moved outside of "from" and "to", so return true immediately
        }
        else {
            return false;
        }
    }
    // If loop completes without finding any transfer matching the criteria, return false
    return false;
}
function convertWETHtoETHforBalanceChanges(balanceChanges) {
    const updatedBalances = Object.assign({}, balanceChanges);
    if (updatedBalances[WETH_ADDRESS]) {
        const wethAmount = updatedBalances[WETH_ADDRESS].amount;
        if (updatedBalances[ETH_ADDRESS]) {
            updatedBalances[ETH_ADDRESS].amount += wethAmount;
        }
        else {
            updatedBalances[ETH_ADDRESS] = { symbol: "ETH", amount: wethAmount };
        }
        delete updatedBalances[WETH_ADDRESS];
    }
    return updatedBalances;
}
export function marketArbitrageSection(readableTransfers, calledContractAddress) {
    const calculateBalanceChangesForSwaps = (swaps, calledContractAddress) => {
        let balanceChange = {};
        const calledAddressLower = calledContractAddress.toLowerCase();
        const calculateForSwap = (swap) => {
            for (const transfer of swap) {
                const address = transfer.tokenAddress;
                const symbol = transfer.tokenSymbol || "Unknown Token";
                if (!balanceChange[address]) {
                    balanceChange[address] = { symbol: symbol, amount: 0 };
                }
                if (transfer.from.toLowerCase() === calledAddressLower) {
                    balanceChange[address].amount -= transfer.parsedAmount;
                }
                if (transfer.to.toLowerCase() === calledAddressLower) {
                    balanceChange[address].amount += transfer.parsedAmount;
                }
            }
        };
        swaps.forEach(calculateForSwap);
        return balanceChange;
    };
    const balanceChangeSwaps = calculateBalanceChangesForSwaps(readableTransfers.swaps, calledContractAddress);
    const balanceChangeMultiStepSwaps = calculateBalanceChangesForSwaps(readableTransfers.multiStepSwaps, calledContractAddress);
    const balanceChangeMints = calculateBalanceChangesForMints(readableTransfers.liquidityPairs, calledContractAddress);
    // Combine balance changes
    const combinedBalanceChanges = mergeBalanceChanges(balanceChangeSwaps, balanceChangeMultiStepSwaps, balanceChangeMints);
    // sum WETH against ETH
    const finalBalanceChanges = convertWETHtoETHforBalanceChanges(combinedBalanceChanges);
    return finalBalanceChanges;
}
export function bribe(readableTransfers, from) {
    let totalOutflowingETH = 0;
    for (const transfer of readableTransfers.outflowingETH) {
        if (transfer.to.toLowerCase() === from.toLowerCase())
            continue; // excluding eth being send from bot to bot owner from bribe amount
        totalOutflowingETH += transfer.parsedAmount;
    }
    return {
        address: ETH_ADDRESS,
        symbol: "ETH",
        amount: totalOutflowingETH,
    };
}
function convertWETHToETH(balanceChanges) {
    let converted = {};
    for (const address in balanceChanges) {
        if (address.toLowerCase() === WETH_ADDRESS) {
            converted[ETH_ADDRESS] = Object.assign(Object.assign({}, balanceChanges[address]), { symbol: "ETH" });
        }
        else {
            converted[address] = balanceChanges[address];
        }
    }
    return converted;
}
/**
 * Get leaf ETH transfers which are neither to "from" nor "to" and are received from "from" or "to".
 *
 * @param transfers List of token transfers
 * @param from Excluded from address as bribe receiver but included as a sender
 * @param to Excluded to address as bribe receiver but included as a sender
 */
function getLeafEthTransfers(transfers, from, to) {
    return transfers.filter((transfer) => {
        const isEthTransfer = transfer.tokenSymbol === "ETH";
        const isLeaf = !transfers.some((otherTransfer) => otherTransfer.from.toLowerCase() === transfer.to.toLowerCase());
        const isNotFromOrTo = transfer.to.toLowerCase() !== from.toLowerCase() && transfer.to.toLowerCase() !== to.toLowerCase();
        const isReceivedFromFromOrTo = transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase();
        return isEthTransfer && isLeaf && isNotFromOrTo && isReceivedFromFromOrTo;
    });
}
// leafs which receive eth and are not bot (to) or botoperator (from)
function calculateBribeAmoundForMoreThanOneBribe(transfers, from, to) {
    const ethLeafTransfers = getLeafEthTransfers(transfers, from, to);
    let bribeAmount = 0;
    ethLeafTransfers.forEach((transfer) => {
        bribeAmount += transfer.parsedAmount;
    });
    return {
        address: ETH_ADDRESS,
        symbol: "ETH",
        amount: bribeAmount,
    };
}
function calculateBribeAmoundForSingleBribe(transfers, from, to) {
    const ethLeafTransfers = getLeafEthTransfers(transfers, from, to);
    if (ethLeafTransfers.length < 2) {
        return calculateBribeAmoundForMoreThanOneBribe(transfers, from, to);
    }
    const bribeTransfer = ethLeafTransfers[ethLeafTransfers.length - 2];
    return {
        address: ETH_ADDRESS,
        symbol: "ETH",
        amount: bribeTransfer.parsedAmount,
    };
}
function calculateExtractedValueCaseValueStaysWithFromOrTo(balanceChanges, bribe) {
    let ethPresent = false;
    const newExtractedValue = balanceChanges.map((change) => {
        const isEth = change.tokenSymbol === "ETH" || change.tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase();
        if (isEth) {
            ethPresent = true;
            return { address: change.tokenAddress, symbol: "ETH", amount: change.balanceChange + bribe };
        }
        return { address: change.tokenAddress, symbol: change.tokenSymbol || "Unknown Token", amount: change.balanceChange };
    });
    if (!ethPresent && bribe > 0) {
        newExtractedValue.push({ address: ETH_ADDRESS, symbol: "ETH", amount: bribe });
    }
    return newExtractedValue;
}
function calculateExtractedValueCaseValueGoesOutsideFromOrTo(transfers, from, to) {
    const accumulatedTransfers = {};
    // Create a set of all 'from' addresses for quick lookup
    const fromAddresses = new Set(transfers.map((transfer) => transfer.from.toLowerCase()));
    // Filtering the transfers that originated from 'from' or 'to' and were sent to some other addresses (not 'from' or 'to')
    // Also checking that the recipient address doesn't show up as a 'from' address in the full transfer list
    let relevantTransfers = transfers.filter((transfer) => (transfer.from.toLowerCase() === from.toLowerCase() || transfer.from.toLowerCase() === to.toLowerCase()) &&
        transfer.to.toLowerCase() !== from.toLowerCase() &&
        transfer.to.toLowerCase() !== to.toLowerCase() &&
        !fromAddresses.has(transfer.to.toLowerCase()));
    // Sort by position and only take the chunk at the end
    if (relevantTransfers.length === 0)
        return null;
    relevantTransfers.sort((a, b) => a.position - b.position);
    let lastPosition = relevantTransfers[relevantTransfers.length - 1].position;
    let endIndex = relevantTransfers.length - 1;
    // Find the start index of the chunk at the end
    while (endIndex > 0 && relevantTransfers[endIndex - 1].position === lastPosition - 1) {
        endIndex--;
        lastPosition--;
    }
    relevantTransfers = relevantTransfers.slice(endIndex);
    for (const transfer of relevantTransfers) {
        if (!accumulatedTransfers[transfer.tokenAddress]) {
            accumulatedTransfers[transfer.tokenAddress] = { symbol: transfer.tokenSymbol || "Unknown Token", amount: 0 };
        }
        accumulatedTransfers[transfer.tokenAddress].amount += transfer.parsedAmount;
    }
    return Object.entries(accumulatedTransfers).map(([address, detail]) => ({
        address,
        symbol: detail.symbol,
        amount: detail.amount,
    }));
}
function calculateNetWin(extractedValue, bribe, gasCostETH) {
    let ethPresent = false;
    const newNetWin = extractedValue.map((item) => {
        const isEth = item.symbol === "ETH" || item.address.toLowerCase() === ETH_ADDRESS.toLowerCase();
        if (isEth) {
            ethPresent = true;
            // Subtracting both bribe and gasCostETH from the amount of ETH
            return Object.assign(Object.assign({}, item), { amount: item.amount - bribe - gasCostETH });
        }
        return item; // For non-ETH tokens, return as it is
    });
    // If there was no ETH in extractedValue, but there are ETH costs, include them as negative value
    if (!ethPresent && (bribe > 0 || gasCostETH > 0)) {
        newNetWin.push({ address: ETH_ADDRESS, symbol: "ETH", amount: -(bribe + gasCostETH) });
    }
    return newNetWin;
}
async function calculateGasInfo(txHash, transactionDetails) {
    const gasUsedResult = await getGasUsedFromReceipt(txHash);
    const gasPriceResult = extractGasPrice(transactionDetails);
    if (!gasUsedResult) {
        throw new Error("Failed to retrieve gasUsed from receipt");
    }
    if (!gasPriceResult) {
        throw new Error("Failed to retrieve gasPrice from transaction details");
    }
    const gasUsed = parseInt(gasUsedResult, 10);
    const gasPrice = parseInt(gasPriceResult, 10);
    const gasCostETH = (gasUsed * gasPrice) / 1e18;
    return { gasUsed, gasPrice, gasCostETH };
}
async function getHistoricalPrices(tokens, timestamp) {
    const uniqueTokens = [...new Set(tokens.map((token) => token.tokenAddress))];
    const priceMap = new Map();
    for (const token of uniqueTokens) {
        const price = await getHistoricalTokenPriceFromDefiLlama(token, timestamp);
        if (price !== null)
            priceMap.set(token.toLowerCase(), price);
    }
    return priceMap;
}
export async function formatArbitrageCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to) {
    const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);
    const bribe = calculateBribeAmoundForMoreThanOneBribe(cleanedTransfers, from, to);
    // Adjusting extractedValue to include bribe
    const extractedValue = calculateExtractedValueCaseValueStaysWithFromOrTo([...balanceChangeFrom, ...balanceChangeTo], bribe.amount);
    const netWin = calculateNetWin(extractedValue, bribe.amount, gasCostETH);
    return {
        bribe,
        extractedValue,
        txGas: { gasUsed, gasPrice, gasCostETH },
        netWin,
    };
}
export async function formatArbitrageCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, from, to) {
    const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);
    const bribe = "unknown";
    const extractedValue = calculateExtractedValueCaseValueGoesOutsideFromOrTo(cleanedTransfers, from, to);
    if (!extractedValue)
        return null;
    const netWin = "unknown";
    return {
        bribe,
        extractedValue,
        txGas: { gasUsed, gasPrice, gasCostETH },
        netWin,
    };
}
/**
 * Determines if a transaction was an atomic arbitrage.
 *
 * An atomic arbitrage is identified when a bot (or an entity)
 * executes a series of swaps (potentially involving multi-step swaps),
 * and ends up with the same token it initially sold.
 *
 * @param transfersCategorized - The categorized transfers of the transaction.
 * @param fromAddress - The address initiating the swaps.
 * @param calledContractAddress - The address of the potentially arbitraging bot/contract.
 * @returns True if an atomic arbitrage is detected, otherwise false.
 */
export async function wasTxAtomicArb(transfersCategorized, fromAddress, calledContractAddress) {
    if (calledContractAddress.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase())
        return false;
    const normalizedCalledContractAddress = calledContractAddress.toLowerCase();
    const normalizedFromAddress = fromAddress.toLowerCase();
    // Merge and sort swaps and multiStepSwaps based on the first transfer's position in each group
    let allSwaps = transfersCategorized.swaps.concat(transfersCategorized.multiStepSwaps).sort((a, b) => { var _a, _b; return (((_a = a[0]) === null || _a === void 0 ? void 0 : _a.position) || 0) - (((_b = b[0]) === null || _b === void 0 ? void 0 : _b.position) || 0); });
    let initialTokenSold = null;
    let involvedSwaps = [];
    for (const swapGroup of allSwaps) {
        let involvedInThisSwap = false;
        for (const swap of swapGroup) {
            if ((swap.from.toLowerCase() === normalizedCalledContractAddress && swap.to.toLowerCase() !== normalizedFromAddress) ||
                (swap.to.toLowerCase() === normalizedCalledContractAddress && swap.from.toLowerCase() !== normalizedFromAddress)) {
                involvedInThisSwap = true;
                involvedSwaps.push(swap);
                if (swap.from.toLowerCase() === normalizedCalledContractAddress) {
                    if (!initialTokenSold) {
                        initialTokenSold = swap.tokenAddress.toLowerCase();
                    }
                }
            }
        }
    }
    if (!initialTokenSold || involvedSwaps.length < 2) {
        return false;
    }
    // Checking for repurchase in the last swap
    const lastSwapGroup = allSwaps[allSwaps.length - 1];
    for (const swap of lastSwapGroup) {
        if (swap.to.toLowerCase() === normalizedCalledContractAddress && swap.tokenAddress.toLowerCase() === initialTokenSold) {
            return true;
        }
    }
    return false;
}
async function augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrageResult, block_unixtime) {
    const uniqueTokens = new Set([ETH_ADDRESS]);
    formattedArbitrageResult.extractedValue.forEach((item) => uniqueTokens.add(item.address));
    if (Array.isArray(formattedArbitrageResult.bribe)) {
        formattedArbitrageResult.bribe.forEach((item) => uniqueTokens.add(item.address));
    }
    if (Array.isArray(formattedArbitrageResult.netWin)) {
        formattedArbitrageResult.netWin.forEach((item) => uniqueTokens.add(item.address));
    }
    // Fetching unique prices
    let prices = new Map();
    for (const token of uniqueTokens) {
        const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);
        if (price !== null) {
            prices.set(token.toLowerCase(), price);
        }
    }
    if (!prices) {
        console.error("Failed to fetch prices for tokens: ", Array.from(uniqueTokens));
        return null;
    }
    const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
    if (!ethPrice) {
        console.error("Failed to fetch the price for ETH");
        return null;
    }
    const calculateUsdValue = (item) => {
        const price = prices.get(item.address.toLowerCase());
        if (price === undefined) {
            return null;
        }
        return Object.assign(Object.assign({}, item), { amountInUSD: item.amount * price });
    };
    const extractedValue = formattedArbitrageResult.extractedValue.map(calculateUsdValue);
    if (extractedValue.includes(null))
        return null;
    const bribeAmount = formattedArbitrageResult.bribe.amount;
    const netWin = formattedArbitrageResult.netWin.map(calculateUsdValue);
    if (netWin.includes(null))
        return null;
    const roundUSD = (value) => +value.toFixed(2);
    return {
        bribeInETH: bribeAmount,
        bribeInUSD: roundUSD(bribeAmount * ethPrice),
        fullCostETH: bribeAmount + formattedArbitrageResult.txGas.gasCostETH,
        fullCostUSD: roundUSD((bribeAmount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
        extractedValue: extractedValue.map((item) => (item ? Object.assign(Object.assign({}, item), { amountInUSD: roundUSD(item.amountInUSD) }) : null)),
        netWin: netWin.map((item) => (item ? Object.assign(Object.assign({}, item), { amountInUSD: roundUSD(item.amountInUSD) }) : null)),
        txGas: Object.assign(Object.assign({}, formattedArbitrageResult.txGas), { gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice) }),
    };
}
function isUnknown(value) {
    return value === "unknown";
}
async function augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(formattedArbitrageResult, block_unixtime) {
    const uniqueTokens = new Set([ETH_ADDRESS]);
    if (!isUnknown(formattedArbitrageResult.extractedValue)) {
        formattedArbitrageResult.extractedValue.forEach((item) => uniqueTokens.add(item.address));
    }
    // Fetching unique prices
    let prices = new Map();
    for (const token of uniqueTokens) {
        const price = await getHistoricalTokenPriceFromDefiLlama(token, block_unixtime);
        if (price !== null) {
            prices.set(token.toLowerCase(), price);
        }
    }
    if (!prices) {
        console.error("Failed to fetch prices for tokens: ", Array.from(uniqueTokens));
        return null;
    }
    const ethPrice = prices.get(ETH_ADDRESS.toLowerCase());
    if (!ethPrice) {
        console.error("Failed to fetch the price for ETH");
        return null;
    }
    const calculateUsdValue = (item) => {
        const price = prices.get(item.address.toLowerCase());
        if (price === undefined) {
            return null;
        }
        return Object.assign(Object.assign({}, item), { amountInUSD: item.amount * price });
    };
    const extractedValue = !isUnknown(formattedArbitrageResult.extractedValue) ? formattedArbitrageResult.extractedValue.map(calculateUsdValue) : "unknown";
    const netWin = !isUnknown(formattedArbitrageResult.netWin) ? formattedArbitrageResult.netWin.map(calculateUsdValue) : "unknown";
    const roundUSD = (value) => +value.toFixed(2);
    return {
        bribeInETH: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : formattedArbitrageResult.bribe.amount,
        bribeInUSD: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : roundUSD(formattedArbitrageResult.bribe.amount * ethPrice),
        fullCostETH: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH,
        fullCostUSD: isUnknown(formattedArbitrageResult.bribe) ? "unknown" : roundUSD((formattedArbitrageResult.bribe.amount + formattedArbitrageResult.txGas.gasCostETH) * ethPrice),
        extractedValue: extractedValue !== "unknown" ? extractedValue.map((item) => (item ? Object.assign(Object.assign({}, item), { amountInUSD: roundUSD(item.amountInUSD) }) : null)) : "unknown",
        netWin: netWin !== "unknown" ? netWin.map((item) => (item ? Object.assign(Object.assign({}, item), { amountInUSD: roundUSD(item.amountInUSD) }) : null)) : "unknown",
        txGas: Object.assign(Object.assign({}, formattedArbitrageResult.txGas), { gasCostUSD: roundUSD(formattedArbitrageResult.txGas.gasCostETH * ethPrice) }),
    };
}
function calculateProfitDetails(usdValuedArbitrageResult) {
    let netWin = "unknown";
    let revenue = "unknown";
    let totalCost = "unknown";
    if (Array.isArray(usdValuedArbitrageResult.netWin)) {
        netWin = usdValuedArbitrageResult.netWin.reduce((acc, cur) => acc + cur.amountInUSD, 0);
    }
    if (Array.isArray(usdValuedArbitrageResult.extractedValue)) {
        revenue = usdValuedArbitrageResult.extractedValue.reduce((acc, cur) => acc + cur.amountInUSD, 0);
    }
    const { bribeInUSD, txGas: { gasCostUSD }, } = usdValuedArbitrageResult;
    if (typeof bribeInUSD === "number" && typeof gasCostUSD === "number") {
        totalCost = bribeInUSD + gasCostUSD;
    }
    return {
        netWin,
        revenue,
        bribe: bribeInUSD,
        gas: gasCostUSD,
        totalCost,
    };
}
function printProfitDetails(profitDetails, txHash) {
    console.log(`\nTxHash ${txHash}`);
    console.log(`Net Win: ${typeof profitDetails.netWin === "number" ? "$" + profitDetails.netWin.toFixed(2) : profitDetails.netWin}`);
    console.log(`Revenue: ${typeof profitDetails.revenue === "number" ? "$" + profitDetails.revenue.toFixed(2) : profitDetails.revenue}`);
    console.log(`Bribe: ${typeof profitDetails.bribe === "number" ? "$" + profitDetails.bribe.toFixed(2) : profitDetails.bribe}`);
    console.log(`Gas: $${profitDetails.gas.toFixed(2)}`);
    console.log(`Total Cost: ${typeof profitDetails.totalCost === "number" ? "$" + profitDetails.totalCost.toFixed(2) : profitDetails.totalCost}`);
}
export async function checkCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to) {
    const txWasAtomicArb = isAtomicArbCaseValueStaysWithFromOrTo(cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to);
    if (!txWasAtomicArb) {
        return null;
    }
    const formattedArbitrage = await formatArbitrageCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
    return formattedArbitrage;
}
export async function checkCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to) {
    const txWasAtomicArb = isAtomicArbCaseValueGoesOutsideFromOrTo(cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to);
    if (!txWasAtomicArb) {
        return null;
    }
    const formattedArbitrage = await formatArbitrageCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, from, to);
    return formattedArbitrage;
}
export function testOtherBribePath(usdValuedArbitrageResult, cleanedTransfers, from, to, formattedArbitrageResult) {
    // Ensure netWin is an array and not "unknown"
    if (usdValuedArbitrageResult.netWin !== "unknown" && usdValuedArbitrageResult.fullCostUSD !== "unknown") {
        // Calculate the sum of amountInUSD in the netWin array
        const sumAmountInUSD = usdValuedArbitrageResult.netWin.reduce((acc, entry) => acc + entry.amountInUSD, 0);
        // If there appears to be a netloss, re-visit bribe logic
        if (sumAmountInUSD < 0) {
            // updating bribe
            const bribe = calculateBribeAmoundForSingleBribe(cleanedTransfers, from, to);
            formattedArbitrageResult.bribe = bribe;
            // updating netWin
            const netWin = calculateNetWin(formattedArbitrageResult.extractedValue, bribe.amount, formattedArbitrageResult.txGas.gasCostETH);
            formattedArbitrageResult.netWin = netWin;
        }
    }
    return formattedArbitrageResult;
}
export const highestBlockPositionWorthChecking = 35;
export async function solveAtomicArb(txId, txHash, cleanedTransfers, from, to) {
    const transactionDetails = await getTransactionDetailsByTxHash(txHash);
    if (!transactionDetails)
        return;
    // const onlyToTransfers = filterTransfersByAddress(cleanedTransfers, to);
    // console.log("onlyToTransfers", onlyToTransfers, "\nto", to);
    const balanceChangeFrom = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);
    console.log("balanceChangeFrom (" + from + ")", balanceChangeFrom);
    const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);
    console.log("balanceChangeTo (" + to + ")", balanceChangeTo);
    if (to.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) {
        // console.log("Not Atomic Arbitrage!");
        return;
    }
    const blockPosition = transactionDetails.transactionIndex;
    if (blockPosition > highestBlockPositionWorthChecking) {
        // console.log("Not Atomic Arbitrage!");
        return;
    }
    // sandwichs' backrun can look like arb: 0x1a4f25133a15c5d226b291e9c5751d910ac1ca796c151f6bc917f3c65a69d340
    // removing that, since its accounted for as sandwich.
    const isBackrun = await isActuallyBackrun(txId);
    if (isBackrun)
        return;
    // Case 1: checking for the atomic arb case in which the profit stays in the bot/bot-operator system
    // Case 2: as in: is not checking for the atomic arb case in which the profit gets forwarded to a 3rd address
    // checking case 1
    let formattedArbitrage = await checkCaseValueStaysWithFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
    let usdValuedArbitrageResult;
    const transaction = await Transactions.findOne({
        where: { tx_hash: { [Op.iLike]: txHash } },
    });
    if (!transaction)
        throw new Error(`Transaction not found for hash: ${txHash}`);
    const block_unixtime = transaction.block_unixtime;
    let revenueStorageLocationCase;
    // (If case 1)
    if (formattedArbitrage) {
        usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
        revenueStorageLocationCase = 1;
    }
    else {
        // If it is not case 1, check for case 2
        formattedArbitrage = await checkCaseValueGoesOutsideFromOrTo(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to);
        if (formattedArbitrage) {
            usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(formattedArbitrage, block_unixtime);
            revenueStorageLocationCase = 2;
        }
    }
    // if formattedArbitrage is empty after checking for both cases, it is not an atomic arbitrage.
    if (!formattedArbitrage) {
        // console.log("Not Atomic Arbitrage!");
        return;
    }
    if (!usdValuedArbitrageResult) {
        console.log("Skipping usdValuedArbitrageResult due to failed price fetching.");
        return;
    }
    // checking for the case in which there was a bribe, and the rev went to an external address as well
    formattedArbitrage = testOtherBribePath(usdValuedArbitrageResult, cleanedTransfers, from, to, formattedArbitrage);
    if (revenueStorageLocationCase === 1) {
        usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
    }
    else if (revenueStorageLocationCase === 2) {
        usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(formattedArbitrage, block_unixtime);
    }
    else {
        return;
    }
    if (!usdValuedArbitrageResult) {
        console.log("Skipping usdValuedArbitrageResult due to failed price fetching.");
        return;
    }
    // console.log("\n\nusdValuedArbitrageResult:", usdValuedArbitrageResult, "\nid", txId, "\ntxHash", txHash);
    const profitDetails = calculateProfitDetails(usdValuedArbitrageResult);
    printProfitDetails(profitDetails, txHash);
}
//# sourceMappingURL=atomicArbDetection.js.map