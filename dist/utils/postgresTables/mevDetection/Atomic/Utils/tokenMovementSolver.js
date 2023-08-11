import Big from "big.js";
import { Coins } from "../../../../../models/Coins.js";
import { fetchDecimalsFromChain, fetchSymbolFromChain } from "../../../Coins.js";
import { findCoinDecimalsById, findCoinIdByAddress, findCoinSymbolById } from "../../../readFunctions/Coins.js";
export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const transferMethodId = "0xa9059cbb";
const transferFromMethodId = "0x23b872dd";
const withdrawMethodId = "0x2e1a7d4d";
const customBurnMethodId = "0xba087652";
const burnFromMethodId = "0x79cc6790";
export function getTokenBalanceChangesForUser(transferEvents, userAddress) {
    let balanceChangesMap = {};
    for (const event of transferEvents) {
        if (!(event.token in balanceChangesMap)) {
            balanceChangesMap[event.token] = BigInt(0);
        }
        let eventValue = BigInt(event.value);
        if (event.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] -= eventValue;
        }
        else if (event.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] += eventValue;
        }
    }
    const balanceChanges = [];
    for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
        if (balanceChange >= BigInt(100)) {
            // check if the balance change is greater or equal to 100
            balanceChanges.push({ token, balanceChange: balanceChange.toString() });
        }
    }
    return balanceChanges;
}
export function calculateEthBalanceChangeForUser(callTrace, userAddress) {
    let balanceChange = 0;
    for (let i = 0; i < callTrace.length; i++) {
        const call = callTrace[i];
        // We only want to consider 'call' types for ETH transfers
        if (call.action.callType !== "call")
            continue;
        // Convert the value to a number for easier calculation
        const value = parseInt(call.action.value, 16);
        // If the user is the sender, decrease their balance
        if (call.action.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange -= value;
        }
        // If the user is the recipient, increase their balance
        if (call.action.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange += value;
        }
    }
    return balanceChange;
}
export function addEthBalanceChange(balanceChanges, ethBalanceChange) {
    if (ethBalanceChange !== 0) {
        balanceChanges.push({
            token: ETH_ADDRESS,
            balanceChange: ethBalanceChange,
        });
    }
    return balanceChanges;
}
async function fetchAndSaveCoinProperty(tokenAddress, propertyName, fetchFunction) {
    if (tokenAddress === ETH_ADDRESS)
        return propertyName === "symbol" ? "ETH" : 18;
    let coin = await Coins.findOne({ where: { address: tokenAddress } });
    if (coin && coin[propertyName]) {
        return coin[propertyName];
    }
    else {
        try {
            const propertyValue = await fetchFunction(tokenAddress);
            if (propertyValue) {
                if (!coin) {
                    const symbol = propertyName === "symbol" ? propertyValue : await fetchSymbolFromChain(tokenAddress);
                    const decimals = propertyName === "decimals" ? propertyValue : await fetchDecimalsFromChain(tokenAddress);
                    if (symbol !== null && symbol !== "" && decimals !== null && decimals !== 0) {
                        coin = await Coins.create({ address: tokenAddress, symbol, decimals });
                    }
                }
                else {
                    coin[propertyName] = propertyValue;
                    await coin.save();
                }
            }
            return propertyValue || null;
        }
        catch (error) {
            return null;
        }
    }
}
export async function adjustBalancesForDecimals(balanceChanges) {
    // Loop over each balance change
    for (let i = 0; i < balanceChanges.length; i++) {
        // Fetch the token's decimals and symbol
        const decimals = await fetchAndSaveCoinProperty(balanceChanges[i].token, "decimals", fetchDecimalsFromChain);
        const symbol = await fetchAndSaveCoinProperty(balanceChanges[i].token, "symbol", fetchSymbolFromChain);
        // If we have valid decimals and symbol, we adjust the balance
        if (decimals && symbol) {
            // Create a Big.js instance of the balance change and the token's decimals
            const balanceBig = new Big(balanceChanges[i].balanceChange);
            const decimalsBig = new Big(10).pow(decimals);
            // Divide the balance change by the token's decimals
            const adjustedBalance = balanceBig.div(decimalsBig).toString();
            // Update the balance change
            balanceChanges[i].balanceChange = adjustedBalance;
            // Update the token symbol
            balanceChanges[i].tokenSymbol = symbol;
        }
        else {
            // If we don't have valid decimals and symbol, we remove this balance change from the array
            balanceChanges.splice(i, 1);
            i--; // adjust the loop counter as the array length has changed
        }
    }
    return balanceChanges;
}
export function getTransferEventsFromTraceForUser(callTraces, userAddress) {
    const transferEvents = [];
    const userAddressLower = userAddress.toLowerCase();
    for (const callTrace of callTraces) {
        const action = callTrace.action;
        if (action.input &&
            (action.input.toLowerCase().startsWith(transferMethodId) ||
                action.input.toLowerCase().startsWith(transferFromMethodId) ||
                action.input.toLowerCase().startsWith(withdrawMethodId) ||
                action.input.toLowerCase().startsWith(customBurnMethodId))) {
            let sender, receiver, amountHex;
            if (action.input.toLowerCase().startsWith(transferMethodId)) {
                sender = action.from;
                // Extract receiver and amount from the input
                receiver = "0x" + action.input.slice(34, 74);
                amountHex = action.input.slice(74, 138);
            }
            else if (action.input.toLowerCase().startsWith(transferFromMethodId)) {
                // Extract sender, receiver and amount from the input for transferFrom
                sender = "0x" + action.input.slice(34, 74);
                receiver = "0x" + action.input.slice(98, 138);
                amountHex = action.input.slice(162, 202);
            }
            else if (action.input.toLowerCase().startsWith(withdrawMethodId)) {
                // Added this block
                sender = action.from;
                // The receiver is the user who sent the transaction
                receiver = action.from;
                // Extract the amount from the input
                amountHex = action.input.slice(10, 74);
            }
            else if (action.input.toLowerCase().startsWith(customBurnMethodId)) {
                // Handle the custom burn function
                sender = action.from;
                // In the burn function the amount is sent to a null address
                receiver = NULL_ADDRESS;
                // Extract the amount from the input
                amountHex = action.input.slice(10, 74);
            }
            if ((sender.toLowerCase() === userAddressLower || receiver.toLowerCase() === userAddressLower) && action.to !== NULL_ADDRESS) {
                const value = BigInt("0x" + amountHex);
                transferEvents.push({
                    token: action.to,
                    from: sender,
                    to: receiver,
                    value: value.toString(),
                });
            }
        }
    }
    return transferEvents;
}
function handleTransferMethod(sender, receiver, amountHex, tokenAddress, tokenTransfers) {
    const value = BigInt("0x" + amountHex);
    tokenTransfers.push({
        from: sender,
        to: receiver,
        token: tokenAddress,
        value: value.toString(),
    });
}
function handleUnwrapWethMethod(sender, receiver, amountHex, tokenTransfers) {
    const value = BigInt("0x" + amountHex);
    // Add WETH outgoing transfer
    tokenTransfers.push({
        from: sender,
        to: WETH_ADDRESS,
        token: WETH_ADDRESS,
        value: value.toString(),
    });
    // Add ETH incoming transfer
    // tokenTransfers.push({
    //   from: WETH_ADDRESS,
    //   to: sender,
    //   token: ETH_ADDRESS,
    //   value: value.toString(),
    // });
}
function handleWrapEthMethod(sender, receiver, amountHex, tokenTransfers) {
    const value = BigInt("0x" + amountHex);
    // Add ETH outgoing transfer
    tokenTransfers.push({
        from: sender,
        to: ETH_ADDRESS,
        token: ETH_ADDRESS,
        value: value.toString(),
    });
    // Add WETH incoming transfer
    tokenTransfers.push({
        from: ETH_ADDRESS,
        to: sender,
        token: WETH_ADDRESS,
        value: value.toString(),
    });
}
function extractTransferDetails(input, from) {
    let sender = "";
    let receiver = "";
    let amountHex = "";
    if (input.toLowerCase().startsWith(transferMethodId)) {
        sender = from;
        receiver = "0x" + input.slice(34, 74);
        amountHex = input.slice(74, 138);
    }
    else if (input.toLowerCase().startsWith(transferFromMethodId)) {
        sender = "0x" + input.slice(34, 74);
        receiver = "0x" + input.slice(98, 138);
        amountHex = input.slice(162, 202);
    }
    else if (input.toLowerCase().startsWith(withdrawMethodId)) {
        sender = from;
        receiver = from;
        amountHex = input.slice(10, 74);
    }
    else if (input.toLowerCase().startsWith(customBurnMethodId)) {
        sender = from;
        receiver = NULL_ADDRESS;
        amountHex = input.slice(10, 74);
    }
    else if (input.toLowerCase().startsWith(burnFromMethodId)) {
        sender = "0x" + input.slice(34, 74);
        receiver = NULL_ADDRESS;
        amountHex = input.slice(74, 138);
    }
    return { sender, receiver, amountHex };
}
function extractTokenTransfers(trace, tokenTransfers) {
    const action = trace.action;
    if (action.input &&
        (action.input.toLowerCase().startsWith(transferMethodId) ||
            action.input.toLowerCase().startsWith(transferFromMethodId) ||
            action.input.toLowerCase().startsWith(withdrawMethodId) ||
            action.input.toLowerCase().startsWith(customBurnMethodId) ||
            action.input.toLowerCase().startsWith(burnFromMethodId))) {
        const { sender, receiver, amountHex } = extractTransferDetails(action.input, action.from);
        if (action.to !== NULL_ADDRESS && sender && receiver && amountHex) {
            if (action.to.toLowerCase() === WETH_ADDRESS.toLowerCase() && sender.toLowerCase() === receiver.toLowerCase()) {
                handleUnwrapWethMethod(sender, receiver, amountHex, tokenTransfers);
            }
            else if (action.from.toLowerCase() === action.to.toLowerCase() && action.to.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
                handleWrapEthMethod(sender, receiver, amountHex, tokenTransfers);
            }
            else {
                handleTransferMethod(sender, receiver, amountHex, action.to, tokenTransfers);
            }
        }
    }
    // Checking for Ether (ETH) transfers
    if (action.value && parseInt(action.value, 16) > 0) {
        tokenTransfers.push({
            from: action.from,
            to: action.to,
            value: BigInt(action.value).toString(),
            token: ETH_ADDRESS,
        });
    }
    // Recursively extract token transfers from subtraces
    if (trace.subtraces && Array.isArray(trace.subtraces)) {
        trace.subtraces.forEach((subtrace, index) => extractTokenTransfers(subtrace, tokenTransfers));
    }
}
export async function getTokenTransfersFromTransactionTrace(txTraces) {
    const tokenTransfers = [];
    for (const txTrace of txTraces) {
        extractTokenTransfers(txTrace, tokenTransfers);
    }
    return tokenTransfers;
}
export async function getFullBalanceChangesForAddress(transactionTrace, user) {
    const transfers = getTransferEventsFromTraceForUser(transactionTrace, user);
    const balanceChanges = getTokenBalanceChangesForUser(transfers, user);
    const ethBalanceChange = calculateEthBalanceChangeForUser(transactionTrace, user);
    const balanceChangesWithEth = addEthBalanceChange(balanceChanges, ethBalanceChange);
    const decimalAdjustedBalanceChanges = await adjustBalancesForDecimals(balanceChangesWithEth);
    return decimalAdjustedBalanceChanges;
}
export function filterNullSymbols(readableTransfersRaw) {
    return readableTransfersRaw.filter((transfer) => transfer.tokenSymbol !== null);
}
export async function makeTransfersReadable(tokenTransfers) {
    let readableTransfers = [];
    for (let transfer of tokenTransfers) {
        const coinId = await findCoinIdByAddress(transfer.token);
        let tokenSymbol = null;
        let tokenDecimals = null;
        let parsedAmount = 0;
        if (coinId !== null) {
            tokenSymbol = await findCoinSymbolById(coinId);
            tokenDecimals = await findCoinDecimalsById(coinId);
            if (tokenDecimals !== null) {
                const rawAmountBigInt = BigInt(transfer.value);
                const coinAmount = Number(rawAmountBigInt) / Math.pow(10, tokenDecimals);
                parsedAmount = Number(coinAmount.toFixed(15));
            }
        }
        readableTransfers.push({
            from: transfer.from,
            to: transfer.to,
            tokenAddress: transfer.token,
            tokenSymbol,
            parsedAmount,
        });
    }
    readableTransfers = filterNullSymbols(readableTransfers);
    return addPositionField(readableTransfers);
}
function addPositionField(readableTransfers) {
    return readableTransfers.map((transfer, index) => {
        return Object.assign(Object.assign({}, transfer), { position: index });
    });
}
// Helper function to identify swap pairs
function identifySwapPairs(transfers) {
    const swapPairs = [];
    let remainingTransfers = [...transfers];
    for (let i = 0; i < remainingTransfers.length - 1; i++) {
        for (let j = i + 1; j < remainingTransfers.length; j++) {
            const currentTransfer = remainingTransfers[i];
            const potentialPairTransfer = remainingTransfers[j];
            if (currentTransfer.from === potentialPairTransfer.to && currentTransfer.to === potentialPairTransfer.from) {
                swapPairs.push([currentTransfer, potentialPairTransfer]);
                remainingTransfers = remainingTransfers.filter((_, index) => index !== i && index !== j);
                i--;
                break;
            }
        }
    }
    return { swapPairs, remainingTransfers };
}
// Helper function to categorize ETH inflow and outflow
function categorizeEthFlows(transfers, addressesCount) {
    const inflowingETH = [];
    const outflowingETH = [];
    const remainingTransfers = transfers.filter((transfer) => {
        const isETHTransfer = transfer.tokenSymbol === "ETH";
        if (isETHTransfer && addressesCount[transfer.to] > 1) {
            inflowingETH.push(transfer);
            return false;
        }
        else if (isETHTransfer && addressesCount[transfer.from] > 1) {
            outflowingETH.push(transfer);
            return false;
        }
        return true;
    });
    return { inflowingETH, outflowingETH, remainingTransfers };
}
// Helper function to identify isolated transfers
function identifyIsolatedTransfers(transfers) {
    const isolatedTransfers = [];
    const remainingTransfers = transfers.filter((transfer) => {
        const addresses = transfers.map((t) => t.from).concat(transfers.map((t) => t.to));
        const isUniqueAddress = (address) => addresses.filter((a) => a === address).length === 1;
        if (isUniqueAddress(transfer.from) || isUniqueAddress(transfer.to)) {
            isolatedTransfers.push(transfer);
            return false;
        }
        return true;
    });
    return { isolatedTransfers, remainingTransfers };
}
// Helper function to identify multi-step swaps
function identifyMultiStepSwaps(transfers) {
    const multiStepSwaps = [];
    let remainingTransfers = [...transfers];
    for (let i = 0; i < remainingTransfers.length; i++) {
        let currentTransfer = remainingTransfers[i];
        let swapSequence = [currentTransfer];
        for (let j = i + 1; j < remainingTransfers.length; j++) {
            let nextTransfer = remainingTransfers[j];
            if (nextTransfer.from === currentTransfer.to && nextTransfer.to !== swapSequence[0].from) {
                swapSequence.push(nextTransfer);
                currentTransfer = nextTransfer;
            }
            else if (nextTransfer.from === currentTransfer.to && nextTransfer.to === swapSequence[0].from) {
                swapSequence.push(nextTransfer);
                multiStepSwaps.push(swapSequence);
                break;
            }
        }
    }
    remainingTransfers = remainingTransfers.filter((transfer) => !multiStepSwaps.flat().includes(transfer));
    return { multiStepSwaps, remainingTransfers };
}
// Helper function to remove categorized multi-step swaps
function removeMultiStepSwaps(transfers, swaps) {
    return transfers.filter((transfer) => !swaps.flat().includes(transfer));
}
function identifyLiquidityEvents(transfers) {
    let remainingTransfers = [...transfers];
    const liquidityEvents = [];
    for (let i = 0; i < remainingTransfers.length - 1; i++) {
        const currentTransfer = remainingTransfers[i];
        const returnTransfers = remainingTransfers.filter((transfer) => transfer.from === currentTransfer.to && transfer.to === currentTransfer.from);
        if (returnTransfers.length > 1) {
            liquidityEvents.push([currentTransfer, returnTransfers]);
            remainingTransfers = remainingTransfers.filter((transfer) => transfer !== currentTransfer && !returnTransfers.includes(transfer));
            i--;
        }
    }
    return { liquidityEvents, remainingTransfers };
}
export function categorizeTransfers(transfers) {
    const addressesThatAppearMultipleTimes = {};
    transfers.forEach((transfer) => {
        addressesThatAppearMultipleTimes[transfer.from] = (addressesThatAppearMultipleTimes[transfer.from] || 0) + 1;
        addressesThatAppearMultipleTimes[transfer.to] = (addressesThatAppearMultipleTimes[transfer.to] || 0) + 1;
    });
    const { liquidityEvents, remainingTransfers: postLiquidityEventTransfers } = identifyLiquidityEvents(transfers);
    const { swapPairs, remainingTransfers: postSwapTransfers } = identifySwapPairs(postLiquidityEventTransfers);
    const { inflowingETH, outflowingETH, remainingTransfers: postEthFlowTransfers } = categorizeEthFlows(postSwapTransfers, addressesThatAppearMultipleTimes);
    const { isolatedTransfers, remainingTransfers: postIsolatedTransfers } = identifyIsolatedTransfers(postEthFlowTransfers);
    const { multiStepSwaps, remainingTransfers: postMultiStepTransfers } = identifyMultiStepSwaps(postIsolatedTransfers);
    const remainder = removeMultiStepSwaps(postMultiStepTransfers, multiStepSwaps);
    return {
        liquidityEvents,
        swaps: swapPairs,
        inflowingETH,
        outflowingETH,
        multiStepSwaps,
        isolatedTransfers,
        remainder,
    };
}
//# sourceMappingURL=tokenMovementSolver.js.map