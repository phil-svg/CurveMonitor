import Big from "big.js";
import { Coins } from "../../../../../models/Coins.js";
import { fetchDecimalsFromChain, fetchSymbolFromChain } from "../../../Coins.js";
import { findCoinDecimalsById, findCoinIdByAddress, findCoinSymbolById } from "../../../readFunctions/Coins.js";
const ADDRESS_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const transferMethodId = "0xa9059cbb";
const transferFromMethodId = "0x23b872dd";
const withdrawMethodId = "0x2e1a7d4d";
const customBurnMethodId = "0xba087652";
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
            token: ADDRESS_ETH,
            balanceChange: ethBalanceChange,
        });
    }
    return balanceChanges;
}
async function fetchAndSaveCoinProperty(tokenAddress, propertyName, fetchFunction) {
    if (tokenAddress === ADDRESS_ETH)
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
function extractTokenTransfers(trace, tokenTransfers) {
    const action = trace.action;
    if (action.input &&
        (action.input.toLowerCase().startsWith(transferMethodId) ||
            action.input.toLowerCase().startsWith(transferFromMethodId) ||
            action.input.toLowerCase().startsWith(withdrawMethodId) ||
            action.input.toLowerCase().startsWith(customBurnMethodId))) {
        let sender, receiver, amountHex;
        if (action.input.toLowerCase().startsWith(transferMethodId)) {
            sender = action.from;
            receiver = "0x" + action.input.slice(34, 74);
            amountHex = action.input.slice(74, 138);
        }
        else if (action.input.toLowerCase().startsWith(transferFromMethodId)) {
            sender = "0x" + action.input.slice(34, 74);
            receiver = "0x" + action.input.slice(98, 138);
            amountHex = action.input.slice(162, 202);
        }
        else if (action.input.toLowerCase().startsWith(withdrawMethodId)) {
            sender = action.from;
            receiver = action.from;
            amountHex = action.input.slice(10, 74);
        }
        else if (action.input.toLowerCase().startsWith(customBurnMethodId)) {
            sender = action.from;
            receiver = NULL_ADDRESS;
            amountHex = action.input.slice(10, 74);
        }
        if (action.to !== NULL_ADDRESS && sender && receiver) {
            const value = BigInt("0x" + amountHex);
            tokenTransfers.push({
                token: action.to,
                from: sender,
                to: receiver,
                value: value.toString(),
            });
        }
    }
    // Recursively extract token transfers from subtraces
    if (trace.subtraces && Array.isArray(trace.subtraces)) {
        trace.subtraces.forEach((subtrace) => extractTokenTransfers(subtrace, tokenTransfers));
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
export async function makeTransfersReadable(tokenTransfers) {
    const readableTransfers = [];
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
    return readableTransfers;
}
//# sourceMappingURL=utils.js.map