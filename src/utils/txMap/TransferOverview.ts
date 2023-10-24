import { ITransactionTrace, ParsedEvent, ReadableTokenTransfer, TokenTransfer } from "../Interfaces.js";
import { ETH_ADDRESS, NULL_ADDRESS, WETH_ADDRESS } from "../helperFunctions/Constants.js";
import { getMethodId } from "../helperFunctions/MethodID.js";
import { checkTokensInDatabase } from "./TransferCategories.js";
import { findCoinDecimalsById, findCoinIdByAddress, findCoinSymbolById } from "../postgresTables/readFunctions/Coins.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { ethers } from "ethers";

export function updateTransferList(readableTransfers: ReadableTokenTransfer[], to: string): ReadableTokenTransfer[] {
  // console.log("readableTransfers", readableTransfers);

  const transfersWithEthWETH = addMissingETHWETHTransfers(readableTransfers);
  // console.log("transfersWithEthWETH", transfersWithEthWETH);

  const transfersWithAllMints = addMissingMintsToTransfers(transfersWithEthWETH, to);
  // console.log("transfersWithAllMints", transfersWithAllMints);

  return transfersWithAllMints;
}

// finds token transfers from "to" to elsewhere, where the token came out of nowhere (no inflow). Used to complete transfer list.
export function findUnaccountedOutgoingTransfers(updatedReadableTransfers: ReadableTokenTransfer[], to: string): ReadableTokenTransfer[] {
  const outgoingTransfers = updatedReadableTransfers.filter((transfer) => transfer.from.toLowerCase() === to.toLowerCase());

  const incomingTransfers = updatedReadableTransfers.filter((transfer) => transfer.to.toLowerCase() === to.toLowerCase());

  const unaccountedOutgoings = outgoingTransfers.filter(
    (outgoingTransfer) => !incomingTransfers.some((incomingTransfer) => incomingTransfer.tokenAddress.toLowerCase() === outgoingTransfer.tokenAddress.toLowerCase())
  );

  return unaccountedOutgoings;
}

export function addMissingMintsToTransfers(updatedReadableTransfers: ReadableTokenTransfer[], to: string): ReadableTokenTransfer[] {
  const unaccountedOutgoings = findUnaccountedOutgoingTransfers(updatedReadableTransfers, to);

  let modifiedTransfers = [...updatedReadableTransfers];

  unaccountedOutgoings.forEach((unaccounted) => {
    if (unaccounted.position! <= 5) return;
    const mintTransfer: ReadableTokenTransfer = {
      from: unaccounted.tokenAddress,
      to: to,
      tokenAddress: unaccounted.tokenAddress,
      tokenSymbol: unaccounted.tokenSymbol,
      parsedAmount: unaccounted.parsedAmount,
      position: unaccounted.position !== undefined ? unaccounted.position : undefined,
    };

    if (mintTransfer.position !== undefined) {
      // Inserting mint just before the unaccounted transfer.
      modifiedTransfers.splice(mintTransfer.position, 0, mintTransfer);

      // Adjusting positions of subsequent transfers.
      for (let i = mintTransfer.position + 1; i < modifiedTransfers.length; i++) {
        if (modifiedTransfers[i].position !== undefined) {
          modifiedTransfers[i].position! += 1;
        }
      }
    }
  });

  return modifiedTransfers;
}

// adds a phantom weth transfer upon eth-deposit, or vice versa, to fix balance-accounting
export function addMissingETHWETHTransfers(transfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  const modifiedTransfers: ReadableTokenTransfer[] = [...transfers];

  for (let i = 0; i < modifiedTransfers.length; i++) {
    const transfer = modifiedTransfers[i];

    if (!transfer.to || !transfer.tokenSymbol) {
      continue;
    }

    if (transfer.tokenSymbol === "ETH" && transfer.to.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      const correspondingWETHTransfer = {
        from: WETH_ADDRESS,
        to: transfer.from,
        tokenAddress: WETH_ADDRESS,
        tokenSymbol: "WETH",
        parsedAmount: transfer.parsedAmount,
        position: transfer.position !== undefined ? transfer.position + 1 : undefined,
      };

      if (!existsInTransfers(correspondingWETHTransfer, modifiedTransfers)) {
        incrementPositionsFromIndex(i + 1, modifiedTransfers);
        modifiedTransfers.splice(i + 1, 0, correspondingWETHTransfer);
      }
    }

    if (transfer.tokenSymbol === "WETH" && transfer.to.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      const correspondingETHTransfer = {
        from: WETH_ADDRESS,
        to: transfer.from,
        tokenAddress: ETH_ADDRESS,
        tokenSymbol: "ETH",
        parsedAmount: transfer.parsedAmount,
        position: transfer.position !== undefined ? transfer.position + 1 : undefined,
      };

      if (!existsInTransfers(correspondingETHTransfer, modifiedTransfers)) {
        incrementPositionsFromIndex(i + 1, modifiedTransfers);
        modifiedTransfers.splice(i + 1, 0, correspondingETHTransfer);
      }
    }
  }

  return modifiedTransfers;
}

function existsInTransfers(transfer: ReadableTokenTransfer, transfers: ReadableTokenTransfer[]): boolean {
  return transfers.some(
    (t) =>
      t.from.toLowerCase() === transfer.from.toLowerCase() &&
      t.to.toLowerCase() === transfer.to.toLowerCase() &&
      t.tokenSymbol === transfer.tokenSymbol &&
      t.parsedAmount === transfer.parsedAmount
  );
}

function incrementPositionsFromIndex(index: number, transfers: ReadableTokenTransfer[]): void {
  for (let j = index; j < transfers.length; j++) {
    if (transfers[j] && transfers[j].position !== undefined) {
      transfers[j].position! += 1;
    }
  }
}

export function removeDuplicatesAndUpdatePositions(transfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
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
        tokenAddress: "0x0000000000085d4780b73119b644ae5ecd22b376", // real
        tokenSymbol: "TUSD",
        parsedAmount: 237.97344971942732,
        position: 9,
      },
      {
        from: "0x0000000000085d4780b73119b644ae5ecd22b376",
        to: "0x2acf35c9a3f4c5c3f4c78ef5fb64c3ee82f07c45",
        tokenAddress: "0xb650eb28d35691dd1bd481325d40e65273844f9b", // fake
        tokenSymbol: "TUSD",
        parsedAmount: 237.97344971942732,
        position: 10,
      },
    ];
    if (nextTransfer.position === currentTransfer.position! + 1 && currentTransfer.to === nextTransfer.to && currentTransfer.tokenAddress === nextTransfer.from) {
      // Remove the nextTransfer from the filtered list
      filtered.splice(i + 1, 1);
      i--; // Adjust index due to removal
      continue; // Skip to next iteration
    }

    // Check for the new criterion
    if (
      currentTransfer.from === nextTransfer.from &&
      currentTransfer.to === nextTransfer.to &&
      currentTransfer.parsedAmount === nextTransfer.parsedAmount &&
      currentTransfer.tokenSymbol === nextTransfer.tokenSymbol &&
      currentTransfer.tokenAddress !== nextTransfer.tokenAddress
    ) {
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

export function filterNullSymbols(readableTransfersRaw: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  return readableTransfersRaw.filter((transfer) => transfer.tokenSymbol !== null && transfer.tokenSymbol !== "" && transfer.tokenSymbol !== " ");
}

function addPositionField(readableTransfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  return readableTransfers.map((transfer, index) => {
    return {
      ...transfer,
      position: index,
    };
  });
}

export async function makeTransfersReadable(tokenTransfers: TokenTransfer[]): Promise<ReadableTokenTransfer[]> {
  await checkTokensInDatabase(tokenTransfers);

  let readableTransfers: ReadableTokenTransfer[] = [];

  for (let transfer of tokenTransfers) {
    const coinId = await findCoinIdByAddress(transfer.token);
    let tokenSymbol: string | null = null;
    let tokenDecimals: number | null = null;
    let parsedAmount = 0;

    if (coinId === null) continue;

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

function handleTransferMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const sender = action.from;
  const tokenAddress = action.to;
  const receiver = "0x" + action.input.slice(34, 74);
  const amountHex = "0x" + action.input.slice(74, 138);
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: sender,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleTransferFromMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const sender = "0x" + action.input.slice(34, 74);
  const receiver = "0x" + action.input.slice(98, 138);
  const amountHex = "0x" + action.input.slice(162, 202);
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: sender,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleUnwrapWethMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const from = action.from;
  const amountHex = "0x" + action.input.slice(10, 74);
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: from,
    to: WETH_ADDRESS,
    token: WETH_ADDRESS,
    value: value.toString(),
  });
}

function handleWrapMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  return; // voiding for now
  const from = action.from;
  const amountHex = action.input;
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: from,
    to: WETH_ADDRESS,
    token: ETH_ADDRESS,
    value: value.toString(),
  });

  tokenTransfers.push({
    from: WETH_ADDRESS,
    to: from,
    token: WETH_ADDRESS,
    value: value.toString(),
  });
}

function handleMintMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const receiver = "0x" + action.input.slice(34, 74);
  const amountHex = "0x" + action.input.slice(-64);
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: NULL_ADDRESS,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleBurnMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const fromAddress = "0x" + action.input.slice(34, 74);
  const amountHex = "0x" + action.input.slice(-64);
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: fromAddress,
    to: NULL_ADDRESS,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleAddLiquidityMethod(action: any, trace: ITransactionTrace, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const amountHex = trace.result.output;
  const receiver = trace.action.from;
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  // catching not real lp transfers, see trace of 0x31a8c4bf5a4c22a782129f0760d68d2db372aa6584d8e0afecb6cf0f22eff514
  if (/0{10,}$/.test(amountHex)) {
    return;
  }

  tokenTransfers.push({
    from: NULL_ADDRESS,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleDepositMethod(action: any, trace: ITransactionTrace, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const amountHex = trace.result.output;
  const receiver = trace.action.from;
  const value = amountHex === "0x" ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: NULL_ADDRESS,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

export async function getTokenTransfersFromTransactionTrace(txTraces: ITransactionTrace[]): Promise<TokenTransfer[]> {
  const tokenTransfers: TokenTransfer[] = [];

  const web3HttpProvider = await getWeb3HttpProvider();
  const JsonRpcProvider = new ethers.JsonRpcProvider(process.env.WEB3_HTTP);

  // Extract all unique contract addresses
  const uniqueContractAddresses = new Set(txTraces.map((trace) => trace.action.to));

  // Prefetch method IDs
  for (const contractAddress of uniqueContractAddresses) {
    await getMethodId(contractAddress, JsonRpcProvider, web3HttpProvider);
  }

  // Process txTraces
  for (const txTrace of txTraces) {
    await extractTokenTransfers(txTrace, tokenTransfers, JsonRpcProvider, web3HttpProvider);
  }

  return tokenTransfers;
}

async function extractTokenTransfers(trace: ITransactionTrace, tokenTransfers: TokenTransfer[], JsonRpcProvider: any, web3HttpProvider: any): Promise<void> {
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

function handleDynamicMethod(methodName: string, action: any, tokenTransfers: TokenTransfer[], trace: ITransactionTrace) {
  switch (methodName) {
    case "transfer":
      handleTransferMethod(action, tokenTransfers);
      break;

    case "transferFrom":
      handleTransferFromMethod(action, tokenTransfers);
      break;

    case "withdraw":
      handleUnwrapWethMethod(action, tokenTransfers);
      break;

    case "wrap":
      handleWrapMethod(action, tokenTransfers);
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

export function mergeAndFilterTransfers(tokenTransfersFromTransactionTraces: TokenTransfer[], parsedEventsFromReceipt: (ParsedEvent | null | undefined)[]): TokenTransfer[] {
  const filteredEvents = parsedEventsFromReceipt.filter((event) => event?.eventName === "Transfer");

  for (const event of filteredEvents) {
    if (event) {
      const keys = Object.keys(event);

      const matchingTransfer = tokenTransfersFromTransactionTraces.find(
        (transfer) =>
          transfer.from.toLowerCase() === event[keys[0]].toLowerCase() &&
          transfer.to.toLowerCase() === event[keys[1]].toLowerCase() &&
          transfer.token.toLowerCase() === event.contractAddress.toLowerCase()
      );

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
