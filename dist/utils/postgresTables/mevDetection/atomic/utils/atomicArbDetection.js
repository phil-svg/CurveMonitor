import { CoWProtocolGPv2Settlement, ETH_ADDRESS, WETH_ADDRESS } from "../../../../helperFunctions/Constants.js";
import { getGasUsedFromReceipt } from "../../../readFunctions/Receipts.js";
import { extractGasPrice, getTransactionDetailsByTxHash } from "../../../readFunctions/TransactionDetails.js";
export async function getBalanceChangeForAddressFromTransfers(walletAddress, cleanedTransfers) {
    const balances = {};
    cleanedTransfers.forEach((transfer) => {
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
    // Filter out values smaller than 1e-7 in magnitude
    const filteredBalances = Object.keys(balances)
        .filter((token) => Math.abs(balances[token].amount) >= 1e-7)
        .map((token) => ({
        address: token,
        symbol: balances[token].symbol,
        amount: balances[token].amount,
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
export function calculateNetWin(combinedBalanceChanges, bribe, gasCostETH) {
    let netWin = Object.assign({}, combinedBalanceChanges);
    // Subtract bribe from WETH if exists
    if (netWin[WETH_ADDRESS]) {
        netWin[WETH_ADDRESS] = Object.assign(Object.assign({}, netWin[WETH_ADDRESS]), { amount: netWin[WETH_ADDRESS].amount - bribe.amount });
    }
    // Subtract bribe from ETH if WETH doesn't exist
    else if (netWin[ETH_ADDRESS]) {
        netWin[ETH_ADDRESS] = Object.assign(Object.assign({}, netWin[ETH_ADDRESS]), { amount: netWin[ETH_ADDRESS].amount - bribe.amount });
    }
    // Add negative bribe to ETH if neither exists
    else {
        netWin[ETH_ADDRESS] = { symbol: "ETH", amount: -bribe.amount };
    }
    // Convert WETH to ETH
    netWin = convertWETHToETH(netWin);
    // Subtract gasCostETH
    if (netWin[ETH_ADDRESS]) {
        netWin[ETH_ADDRESS] = Object.assign(Object.assign({}, netWin[ETH_ADDRESS]), { amount: netWin[ETH_ADDRESS].amount - gasCostETH });
    }
    // If ETH doesn't exist in netWin after converting WETH, add negative gasCostETH to ETH
    else {
        netWin[ETH_ADDRESS] = { symbol: "ETH", amount: -gasCostETH };
    }
    return netWin;
}
export async function formatArbitrage(transfersCategorized, txHash, transactionDetails, fromAddress, calledContractAddress) {
    const gasUsedResult = await getGasUsedFromReceipt(txHash);
    const gasPriceResult = extractGasPrice(transactionDetails);
    if (!gasUsedResult) {
        throw new Error("Failed to retrieve gasUsed from receipt");
    }
    const gasUsed = parseInt(gasUsedResult, 10);
    if (!gasPriceResult) {
        throw new Error("Failed to retrieve gasUsed from receipt");
    }
    const gasPrice = parseInt(gasPriceResult, 10);
    const combinedBalanceChanges = marketArbitrageSection(transfersCategorized, calledContractAddress);
    const bribeAmount = bribe(transfersCategorized, fromAddress);
    const gasCostETH = (gasUsed * gasPrice) / 1e18;
    const netWin = calculateNetWin(combinedBalanceChanges, bribeAmount, gasCostETH);
    const formattedResult = {
        bribe: bribeAmount,
        extractedValue: Object.entries(combinedBalanceChanges).map(([address, { symbol, amount }]) => ({ address, symbol, amount })),
        txGas: {
            gasUsed: gasUsed,
            gasPrice: gasPrice,
            gasCostETH: gasCostETH,
        },
        netWin: Object.entries(netWin).map(([address, { symbol, amount }]) => ({ address, symbol, amount })),
    };
    return formattedResult;
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
export async function solveAtomicArb(txHash, transfersCategorized, cleanedTransfers, from, to) {
    const transactionDetails = await getTransactionDetailsByTxHash(txHash);
    if (!transactionDetails)
        return;
    // const balanceChangeFrom = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);
    // console.log("balanceChangeFrom", balanceChangeFrom);
    // const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);
    // console.log("balanceChangeTo", balanceChangeTo);
    const txWasAtomicArb = await wasTxAtomicArb(transfersCategorized, from, to);
    if (txWasAtomicArb) {
        const formattedArbitrage = await formatArbitrage(transfersCategorized, txHash, transactionDetails, from, to);
        console.log("\nformattedArbitrage:", formattedArbitrage);
    }
    else {
        console.log("Not Atomic Arbitrage!");
    }
}
//# sourceMappingURL=atomicArbDetection.js.map