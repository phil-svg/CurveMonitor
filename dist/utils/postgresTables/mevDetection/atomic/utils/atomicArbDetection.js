import { getGasUsedFromReceipt } from "../../../readFunctions/Receipts.js";
import { extractGasPrice, extractTransactionAddresses, getTransactionDetailsByTxHash } from "../../../readFunctions/TransactionDetails.js";
import { getTransactionTraceFromDb } from "../../../readFunctions/TransactionTrace.js";
import { ETH_ADDRESS, WETH_ADDRESS, getCategorizedTransfersFromTxTrace } from "./tokenMovementSolver.js";
const CoWProtocolGPv2Settlement = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
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
const calculateBalanceChangesForMints = (mintPairs, calledContractAddress) => {
    let balanceChange = {};
    const calledAddressLower = calledContractAddress.toLowerCase();
    mintPairs.forEach((pair) => {
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
export function marketArbitrageSection(readableTransfers, fromAddress, calledContractAddress) {
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
    const balanceChangeMints = calculateBalanceChangesForMints(readableTransfers.mintPairs, calledContractAddress);
    // Combine balance changes
    const combinedBalanceChanges = mergeBalanceChanges(balanceChangeSwaps, balanceChangeMultiStepSwaps, balanceChangeMints);
    return combinedBalanceChanges;
}
export function bribe(readableTransfers) {
    let totalOutflowingETH = 0;
    for (const transfer of readableTransfers.outflowingETH) {
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
    const combinedBalanceChanges = marketArbitrageSection(transfersCategorized, fromAddress, calledContractAddress);
    const bribeAmount = bribe(transfersCategorized);
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
export async function solveAtomicArbForTxHash(txHash) {
    const transactionTraces = await getTransactionTraceFromDb(txHash);
    // console.log("transactionTraces", transactionTraces);
    if (!transactionTraces || transactionTraces.length === 0) {
        console.log(`no transaction-trace found for ${txHash}`);
        return;
    }
    const transfersCategorized = await getCategorizedTransfersFromTxTrace(transactionTraces);
    // console.dir(transfersCategorized, { depth: null, colors: true });
    const transactionDetails = await getTransactionDetailsByTxHash(txHash);
    const { from: fromAddress, to: calledContractAddress } = extractTransactionAddresses(transactionDetails);
    if (transactionDetails && fromAddress && calledContractAddress) {
        const txWasAtomicArb = await wasTxAtomicArb(transfersCategorized, fromAddress, calledContractAddress);
        console.log("\ntxHash", txHash);
        if (txWasAtomicArb) {
            const formattedArbitrage = await formatArbitrage(transfersCategorized, txHash, transactionDetails, fromAddress, calledContractAddress);
            console.log("formattedArbitrage.extractedValue:", formattedArbitrage.extractedValue);
        }
        else {
            console.log("Not Atomic Arbitrage!");
        }
    }
    else {
        console.log(`Failed to fetch transactionDetails for ${txHash}, txDetails: ${transactionDetails}, fromAddress: ${fromAddress}, calledContractAddress: ${calledContractAddress}`);
    }
}
//# sourceMappingURL=atomicArbDetection.js.map