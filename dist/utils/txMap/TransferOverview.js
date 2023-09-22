import { ETH_ADDRESS, NULL_ADDRESS, WETH_ADDRESS } from "../helperFunctions/Constants.js";
import { getMethodId } from "../helperFunctions/MethodID.js";
import { checkTokensInDatabase } from "./TransferCategories.js";
import { findCoinDecimalsById, findCoinIdByAddress, findCoinSymbolById } from "../postgresTables/readFunctions/Coins.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { ethers } from "ethers";
// adds a phantom weth transfer upon eth-deposit to fix balance-accounting
export function addMissingWethTransfers(transfers) {
    const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const modifiedTransfers = [];
    for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        modifiedTransfers.push(transfer);
        if (transfer.tokenSymbol === "ETH" && transfer.to === WETH_ADDRESS) {
            // Check if the next transfer is a WETH transfer from WETH_ADDRESS to the same sender
            const nextTransfer = transfers[i + 1];
            const isWethTransferBack = nextTransfer && nextTransfer.from === WETH_ADDRESS && nextTransfer.to === transfer.from && nextTransfer.tokenSymbol === "WETH";
            if (!isWethTransferBack) {
                // Insert the missing WETH transfer
                modifiedTransfers.push({
                    from: WETH_ADDRESS,
                    to: transfer.from,
                    tokenAddress: WETH_ADDRESS,
                    tokenSymbol: "WETH",
                    parsedAmount: transfer.parsedAmount,
                    position: transfer.position + 1,
                });
                // Increment positions for the subsequent transfers
                for (let j = i + 1; j < transfers.length; j++) {
                    if (transfers[j].position !== undefined) {
                        transfers[j].position += 1;
                    }
                }
            }
        }
    }
    return modifiedTransfers;
}
export function removeDuplicatesAndUpdatePositions(transfers) {
    // Creating a copy of the transfers list to avoid in-place modifications
    let filtered = [...transfers];
    // Loop through the list of transfers
    for (let i = 0; i < filtered.length - 1; i++) {
        const currentTransfer = filtered[i];
        const nextTransfer = filtered[i + 1];
        // Check for fake transfers
        const exampleFakeTransfer = [
            {
                from: "0x74de5d4fcbf63e00296fd95d33236b9794016631",
                to: "0x2acf35c9a3f4c5c3f4c78ef5fb64c3ee82f07c45",
                tokenAddress: "0x0000000000085d4780b73119b644ae5ecd22b376",
                tokenSymbol: "TUSD",
                parsedAmount: 237.97344971942732,
                position: 9,
            },
            {
                from: "0x0000000000085d4780b73119b644ae5ecd22b376",
                to: "0x2acf35c9a3f4c5c3f4c78ef5fb64c3ee82f07c45",
                tokenAddress: "0xb650eb28d35691dd1bd481325d40e65273844f9b",
                tokenSymbol: "TUSD",
                parsedAmount: 237.97344971942732,
                position: 10,
            },
        ];
        if (nextTransfer.position === currentTransfer.position + 1 && currentTransfer.to === nextTransfer.to && currentTransfer.tokenAddress === nextTransfer.from) {
            // Remove the nextTransfer from the filtered list
            filtered.splice(i + 1, 1);
            i--; // Adjust index due to removal
            continue; // Skip to next iteration
        }
        // Check for the new criterion
        if (currentTransfer.from === nextTransfer.from &&
            currentTransfer.to === nextTransfer.to &&
            currentTransfer.parsedAmount === nextTransfer.parsedAmount &&
            currentTransfer.tokenSymbol === nextTransfer.tokenSymbol &&
            currentTransfer.tokenAddress !== nextTransfer.tokenAddress) {
            // Remove the nextTransfer from the filtered list
            filtered.splice(i + 1, 1);
            i--; // Adjust index due to removal
        }
    }
    // Adjust positions after filtering
    for (let i = 0; i < filtered.length; i++) {
        filtered[i].position = i;
    }
    return filtered;
}
export function filterNullSymbols(readableTransfersRaw) {
    return readableTransfersRaw.filter((transfer) => transfer.tokenSymbol !== null && transfer.tokenSymbol !== "" && transfer.tokenSymbol !== " ");
}
function addPositionField(readableTransfers) {
    return readableTransfers.map((transfer, index) => {
        return Object.assign(Object.assign({}, transfer), { position: index });
    });
}
export async function makeTransfersReadable(tokenTransfers) {
    await checkTokensInDatabase(tokenTransfers);
    let readableTransfers = [];
    for (let transfer of tokenTransfers) {
        const coinId = await findCoinIdByAddress(transfer.token);
        let tokenSymbol = null;
        let tokenDecimals = null;
        let parsedAmount = 0;
        if (coinId === null)
            continue;
        tokenSymbol = await findCoinSymbolById(coinId);
        tokenDecimals = await findCoinDecimalsById(coinId);
        if (tokenDecimals !== null) {
            const rawAmountBigInt = BigInt(transfer.value);
            const coinAmount = Number(rawAmountBigInt) / Math.pow(10, tokenDecimals);
            parsedAmount = Number(coinAmount.toFixed(15));
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
function handleTransferMethod(action, tokenTransfers) {
    const sender = action.from;
    const tokenAddress = action.to;
    const receiver = "0x" + action.input.slice(34, 74);
    const amountHex = "0x" + action.input.slice(74, 138);
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: sender,
        to: receiver,
        token: tokenAddress,
        value: value.toString(),
    });
}
function handleTransferFromMethod(action, tokenTransfers, trace) {
    const tokenAddress = action.to;
    const sender = "0x" + action.input.slice(34, 74);
    const receiver = "0x" + action.input.slice(98, 138);
    const amountHex = "0x" + action.input.slice(162, 202);
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: sender,
        to: receiver,
        token: tokenAddress,
        value: value.toString(),
    });
}
function handleUnwrapWethMethod(action, tokenTransfers) {
    const from = action.from;
    const amountHex = "0x" + action.input.slice(10, 74);
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: from,
        to: WETH_ADDRESS,
        token: WETH_ADDRESS,
        value: value.toString(),
    });
}
function handleWrapEthMethod(action, tokenTransfers) {
    const from = action.from;
    const amountHex = action.input;
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: from,
        to: ETH_ADDRESS,
        token: ETH_ADDRESS,
        value: value.toString(),
    });
    tokenTransfers.push({
        from: ETH_ADDRESS,
        to: from,
        token: WETH_ADDRESS,
        value: value.toString(),
    });
}
function handleMintMethod(action, tokenTransfers) {
    const tokenAddress = action.to;
    const receiver = "0x" + action.input.slice(34, 74);
    const amountHex = "0x" + action.input.slice(-64);
    tokenTransfers.push({
        from: NULL_ADDRESS,
        to: receiver,
        token: tokenAddress,
        value: BigInt(amountHex).toString(),
    });
}
function handleBurnMethod(action, tokenTransfers) {
    const tokenAddress = action.to;
    const amountHex = "0x" + action.input.slice(-64);
    tokenTransfers.push({
        from: action.from,
        to: NULL_ADDRESS,
        token: tokenAddress,
        value: BigInt(amountHex).toString(),
    });
}
function handleAddLiquidityMethod(action, trace, tokenTransfers) {
    const tokenAddress = action.to;
    const amountHex = trace.result.output;
    const receiver = trace.action.from;
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: NULL_ADDRESS,
        to: receiver,
        token: tokenAddress,
        value: value.toString(),
    });
}
function handleDepositMethod(action, trace, tokenTransfers) {
    const tokenAddress = action.to;
    const amountHex = trace.result.output;
    const receiver = trace.action.from;
    const value = BigInt(amountHex);
    tokenTransfers.push({
        from: NULL_ADDRESS,
        to: receiver,
        token: tokenAddress,
        value: value.toString(),
    });
}
export async function getTokenTransfersFromTransactionTrace(txTraces) {
    const tokenTransfers = [];
    const web3HttpProvider = await getWeb3HttpProvider();
    const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);
    for (const txTrace of txTraces) {
        await extractTokenTransfers(txTrace, tokenTransfers, JsonRpcProvider, web3HttpProvider);
    }
    return tokenTransfers;
}
async function extractTokenTransfers(trace, tokenTransfers, JsonRpcProvider, web3HttpProvider) {
    const methodIds = await getMethodId(trace.action.to, JsonRpcProvider, web3HttpProvider);
    if (trace.action.input && methodIds) {
        const methodId = trace.action.input.slice(0, 10).toLowerCase();
        const methodInfo = methodIds.find((m) => m.methodId === methodId);
        if (methodInfo) {
            handleDynamicMethod(methodInfo.name, trace.action, tokenTransfers, trace);
        }
    }
    // Checking for Ether (ETH) transfers
    if (trace.action.value && parseInt(trace.action.value, 16) > 0) {
        tokenTransfers.push({
            from: trace.action.from,
            to: trace.action.to,
            value: BigInt(trace.action.value).toString(),
            token: ETH_ADDRESS,
        });
    }
    // Recursively extract token transfers from subtraces
    if (trace.subtraces && Array.isArray(trace.subtraces)) {
        for (const subtrace of trace.subtraces) {
            await extractTokenTransfers(subtrace, tokenTransfers, JsonRpcProvider, web3HttpProvider);
        }
    }
}
function handleDynamicMethod(methodName, action, tokenTransfers, trace) {
    switch (methodName) {
        case "transfer":
            handleTransferMethod(action, tokenTransfers);
            break;
        case "transferFrom":
            handleTransferFromMethod(action, tokenTransfers, trace);
            break;
        case "withdraw":
            handleUnwrapWethMethod(action, tokenTransfers);
            break;
        case "wrap":
            handleWrapEthMethod(action, tokenTransfers);
            break;
        case "mint":
            handleMintMethod(action, tokenTransfers);
            break;
        case "burn":
        case "customBurn":
        case "burnFrom":
            handleBurnMethod(action, tokenTransfers);
            break;
        case "add_liquidity":
            handleAddLiquidityMethod(action, trace, tokenTransfers);
            break;
        case "deposit":
            // console.log("deposit", trace);
            break;
        // space for more cases
    }
}
export function mergeAndFilterTransfers(tokenTransfersFromTransactionTraces, parsedEventsFromReceipt) {
    const filteredEvents = parsedEventsFromReceipt.filter((event) => (event === null || event === void 0 ? void 0 : event.eventName) === "Transfer");
    for (const event of filteredEvents) {
        if (event) {
            const keys = Object.keys(event);
            const matchingTransfer = tokenTransfersFromTransactionTraces.find((transfer) => transfer.from.toLowerCase() === event[keys[0]].toLowerCase() &&
                transfer.to.toLowerCase() === event[keys[1]].toLowerCase() &&
                transfer.token.toLowerCase() === event.contractAddress.toLowerCase());
            if (!matchingTransfer) {
                tokenTransfersFromTransactionTraces.push({
                    from: event[keys[0]],
                    to: event[keys[1]],
                    token: event[keys[3]],
                    value: event[keys[2]],
                });
            }
        }
    }
    return tokenTransfersFromTransactionTraces;
}
//# sourceMappingURL=TransferOverview.js.map