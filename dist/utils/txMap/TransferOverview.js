import { ETH_ADDRESS, NULL_ADDRESS, WETH_ADDRESS } from "../helperFunctions/Constants.js";
import { getMethodId } from "../helperFunctions/MethodID.js";
import { checkTokensInDatabase } from "./TransferCategories.js";
import { findCoinDecimalsById, findCoinIdByAddress, findCoinSymbolById } from "../postgresTables/readFunctions/Coins.js";
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
function handleMintMethod(input, tokenAddress, tokenTransfers) {
    const receiver = "0x" + input.slice(34, 74);
    const amountHex = "0x" + input.slice(-64);
    tokenTransfers.push({
        from: NULL_ADDRESS,
        to: receiver,
        value: BigInt(amountHex).toString(),
        token: tokenAddress,
    });
}
function handleBurnMethod(action, input, tokenAddress, tokenTransfers) {
    const amountHex = "0x" + input.slice(-64);
    tokenTransfers.push({
        from: action.from,
        to: NULL_ADDRESS,
        value: BigInt(amountHex).toString(),
        token: tokenAddress,
    });
}
export async function getTokenTransfersFromTransactionTrace(txTraces) {
    const tokenTransfers = [];
    for (const txTrace of txTraces) {
        await extractTokenTransfers(txTrace, tokenTransfers);
    }
    return tokenTransfers;
}
async function extractTokenTransfers(trace, tokenTransfers) {
    const action = trace.action;
    const methodIds = await getMethodId(action.to);
    if (action.input && methodIds) {
        const methodId = action.input.slice(0, 10).toLowerCase();
        const methodInfo = methodIds.find((m) => m.methodId === methodId);
        if (methodInfo) {
            handleDynamicMethod(methodInfo.name, action, tokenTransfers);
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
        for (const subtrace of trace.subtraces) {
            await extractTokenTransfers(subtrace, tokenTransfers);
        }
    }
}
function extractTransferDetails(input, from, methodName) {
    let sender = "";
    let receiver = "";
    let amountHex = "";
    switch (methodName) {
        case "transfer":
            sender = from;
            receiver = "0x" + input.slice(34, 74);
            amountHex = input.slice(74, 138);
            break;
        case "transferFrom":
            sender = "0x" + input.slice(34, 74);
            receiver = "0x" + input.slice(98, 138);
            amountHex = input.slice(162, 202);
            break;
        case "withdraw":
            sender = from;
            receiver = from;
            amountHex = input.slice(10, 74);
            break;
        case "customBurn":
            sender = from;
            receiver = NULL_ADDRESS;
            amountHex = input.slice(10, 74);
            break;
        case "burnFrom":
            sender = "0x" + input.slice(34, 74);
            receiver = NULL_ADDRESS;
            amountHex = input.slice(74, 138);
            break;
        case "burn":
            sender = from;
            receiver = NULL_ADDRESS;
            amountHex = input.slice(10, 74);
            break;
        // space for more cases
    }
    return { sender, receiver, amountHex };
}
function handleDynamicMethod(methodName, action, tokenTransfers) {
    const { input, from, to } = action;
    const { sender, receiver, amountHex } = extractTransferDetails(input, from, methodName);
    if (sender && receiver && amountHex) {
        switch (methodName) {
            case "transfer":
            case "transferFrom":
                handleTransferMethod(sender, receiver, amountHex, to, tokenTransfers);
                break;
            case "withdraw":
                handleUnwrapWethMethod(sender, receiver, amountHex, tokenTransfers);
                break;
            case "wrap":
                handleWrapEthMethod(sender, receiver, amountHex, tokenTransfers);
                break;
            case "mint":
                handleMintMethod(input, to, tokenTransfers);
                break;
            case "customBurn":
            case "burnFrom":
                // TODO: handle burn method
                break;
            case "burn":
                handleBurnMethod(action, input, action.to, tokenTransfers);
                break;
            // room for other cases if needed
        }
    }
}
//# sourceMappingURL=TransferOverview.js.map