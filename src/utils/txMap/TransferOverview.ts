import { ITransactionTrace, ParsedEvent, ReadableTokenTransfer, TokenTransfer } from '../Interfaces.js';
import { ETH_ADDRESS, NULL_ADDRESS, WETH_ADDRESS } from '../helperFunctions/Constants.js';
import { getMethodId } from '../helperFunctions/MethodID.js';
import { checkTokensInDatabase } from './TransferCategories.js';
import { getTokenDetailsForTokenArray, CoinDetails } from '../postgresTables/readFunctions/Coins.js';
import { ERC20_METHODS } from '../helperFunctions/Erc20Abis.js';

export function updateTransferList(readableTransfers: ReadableTokenTransfer[], to: string): ReadableTokenTransfer[] {
  // console.log("readableTransfers", readableTransfers);

  const transfersWithEthWETH = addMissingETHWETHTransfers(readableTransfers);
  // console.log("transfersWithEthWETH", transfersWithEthWETH);

  const transfersWithAllMints = addMissingMintsToTransfers(transfersWithEthWETH, to);
  // console.log("transfersWithAllMints", transfersWithAllMints);

  return transfersWithAllMints;
}

// finds token transfers from "to" to elsewhere, where the token came out of nowhere (no inflow). Used to complete transfer list.
export function findUnaccountedOutgoingTransfers(
  updatedReadableTransfers: ReadableTokenTransfer[],
  to: string
): ReadableTokenTransfer[] {
  const toAddressLower = to?.toLowerCase() ?? '';

  const outgoingTransfers = updatedReadableTransfers.filter(
    (transfer) => transfer.from && transfer.from.toLowerCase() === toAddressLower
  );

  const incomingTransfers = updatedReadableTransfers.filter(
    (transfer) => transfer.to && transfer.to.toLowerCase() === toAddressLower
  );

  const unaccountedOutgoings = outgoingTransfers.filter(
    (outgoingTransfer) =>
      outgoingTransfer.tokenAddress.toLowerCase() !== ETH_ADDRESS.toLowerCase() && // Exclude ETH
      outgoingTransfer.tokenAddress.toLowerCase() !== WETH_ADDRESS.toLowerCase() && // Exclude WETH
      !incomingTransfers.some(
        (incomingTransfer) =>
          incomingTransfer.tokenAddress &&
          outgoingTransfer.tokenAddress &&
          incomingTransfer.tokenAddress.toLowerCase() === outgoingTransfer.tokenAddress.toLowerCase()
      )
  );

  return unaccountedOutgoings;
}

export function addMissingMintsToTransfers(
  updatedReadableTransfers: ReadableTokenTransfer[],
  to: string
): ReadableTokenTransfer[] {
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

    if (transfer.tokenSymbol === 'ETH' && transfer.to.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      const correspondingWETHTransfer = {
        from: WETH_ADDRESS,
        to: transfer.from,
        tokenAddress: WETH_ADDRESS,
        tokenSymbol: 'WETH',
        parsedAmount: transfer.parsedAmount,
        position: transfer.position !== undefined ? transfer.position + 1 : undefined,
      };

      if (!existsInTransfers(correspondingWETHTransfer, modifiedTransfers)) {
        incrementPositionsFromIndex(i + 1, modifiedTransfers);
        modifiedTransfers.splice(i + 1, 0, correspondingWETHTransfer);
      }
    }

    if (transfer.tokenSymbol === 'WETH' && transfer.to.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      const correspondingETHTransfer = {
        from: WETH_ADDRESS,
        to: transfer.from,
        tokenAddress: ETH_ADDRESS,
        tokenSymbol: 'ETH',
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
        from: '0x74de5d4fcbf63e00296fd95d33236b9794016631',
        to: '0x2acf35c9a3f4c5c3f4c78ef5fb64c3ee82f07c45',
        tokenAddress: '0x0000000000085d4780b73119b644ae5ecd22b376', // real
        tokenSymbol: 'TUSD',
        parsedAmount: 237.97344971942732,
        position: 9,
      },
      {
        from: '0x0000000000085d4780b73119b644ae5ecd22b376',
        to: '0x2acf35c9a3f4c5c3f4c78ef5fb64c3ee82f07c45',
        tokenAddress: '0xb650eb28d35691dd1bd481325d40e65273844f9b', // fake
        tokenSymbol: 'TUSD',
        parsedAmount: 237.97344971942732,
        position: 10,
      },
    ];
    if (
      nextTransfer.position === currentTransfer.position! + 1 &&
      currentTransfer.to === nextTransfer.to &&
      currentTransfer.tokenAddress === nextTransfer.from
    ) {
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
  return readableTransfersRaw.filter(
    (transfer) => transfer.tokenSymbol !== null && transfer.tokenSymbol !== '' && transfer.tokenSymbol !== ' '
  );
}

function addPositionField(readableTransfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  return readableTransfers.map((transfer, index) => {
    return {
      ...transfer,
      position: index,
    };
  });
}

function findTokenDetails(
  tokenAddress: string,
  tokenDetailsArray: CoinDetails[]
): { symbol: string | null; decimals: number | null } | null {
  const addressLowerCase = tokenAddress.toLowerCase();
  const details = tokenDetailsArray.find((detail) => detail.address.toLowerCase() === addressLowerCase);
  return details ? { symbol: details.symbol, decimals: details.decimals } : null;
}

export async function makeTransfersReadable(tokenTransfers: TokenTransfer[]): Promise<ReadableTokenTransfer[]> {
  await checkTokensInDatabase(tokenTransfers);

  let readableTransfers: ReadableTokenTransfer[] = [];

  const uniqueTokens = new Set(tokenTransfers.map((transfer) => transfer.token));
  const uniqueTokenArray = Array.from(uniqueTokens);
  const tokenDetailsArray = await getTokenDetailsForTokenArray(uniqueTokenArray);

  for (let transfer of tokenTransfers) {
    const details = findTokenDetails(transfer.token, tokenDetailsArray);
    const tokenSymbol = details?.symbol;
    const tokenDecimals = details?.decimals;

    if (!tokenDecimals || tokenDecimals === 0 || tokenDecimals === 420) continue;
    if (!tokenSymbol) continue;

    let parsedAmount = 0;

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
  const res = addPositionField(readableTransfers);
  return res;
}

function handleTransferMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const sender = action.from;
  const tokenAddress = action.to;
  const receiver = '0x' + action.input.slice(34, 74);
  const amountHex = '0x' + action.input.slice(74, 138);
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: sender,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleTransferFromMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const sender = '0x' + action.input.slice(34, 74);
  const receiver = '0x' + action.input.slice(98, 138);
  const amountHex = '0x' + action.input.slice(162, 202);
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: sender,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleUnwrapWethMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const from = action.from;
  const amountHex = '0x' + action.input.slice(10, 74);
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

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
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

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
  return; // voiding for now.
  const tokenAddress = action.to;
  const receiver = '0x' + action.input.slice(34, 74);
  const hasHexPrefix = action.input.slice(0, 2) === '0x';
  const relevantSlice = hasHexPrefix ? action.input.slice(2) : action.input;
  const amountHex = relevantSlice.slice(-64);

  const trimmedAmountHex = amountHex.replace(/^0+/, '');
  const value = trimmedAmountHex === '' ? BigInt(0) : BigInt('0x' + trimmedAmountHex);

  tokenTransfers.push({
    from: NULL_ADDRESS,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

function handleBurnMethod(action: any, tokenTransfers: TokenTransfer[]): void {
  const tokenAddress = action.to;
  const fromAddress = '0x' + action.input.slice(34, 74);
  const amountHex = '0x' + action.input.slice(-64);
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

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
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

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
  const value = amountHex === '0x' ? BigInt(0) : BigInt(amountHex);

  tokenTransfers.push({
    from: NULL_ADDRESS,
    to: receiver,
    token: tokenAddress,
    value: value.toString(),
  });
}

export async function getTokenTransfersFromTransactionTrace(
  transactionTraces: ITransactionTrace[]
): Promise<TokenTransfer[] | null> {
  const tokenTransfers: TokenTransfer[] = [];
  const localMethodIdCache: { [address: string]: any[] } = {};

  const uniqueContractAddresses = new Set(
    transactionTraces
      .filter(
        (trace) =>
          trace.action.input !== '0x' || trace.action.value !== '0x0' || (trace.result && trace.result.output !== '0x')
      )
      .map((trace) => (trace.action.to ? trace.action.to.toLowerCase() : null))
      .filter((address): address is string => address !== null)
  );

  for (const contractAddress of uniqueContractAddresses) {
    if (!localMethodIdCache[contractAddress]) {
      const fetchedMethodIds = await getMethodId(contractAddress);
      localMethodIdCache[contractAddress] = fetchedMethodIds || [];
    }
  }

  for (const txTrace of transactionTraces) {
    const contractAddress = txTrace.action.to ? txTrace.action.to.toLowerCase() : null;
    if (contractAddress) {
      const methodIds = localMethodIdCache[contractAddress] || [];
      await extractTokenTransfers(txTrace, tokenTransfers, methodIds);
    }
  }

  return tokenTransfers;
}

async function extractTokenTransfers(
  trace: ITransactionTrace,
  tokenTransfers: TokenTransfer[],
  methodIds: any[]
): Promise<void> {
  const contractAddress = trace.action.to ? trace.action.to.toLowerCase() : null;
  if (!contractAddress) return;

  if (trace.action.input) {
    const methodId = trace.action.input.slice(0, 10).toLowerCase();
    const methodsToCheck = methodIds.length > 0 ? methodIds : ERC20_METHODS;
    const methodInfo = methodsToCheck.find((m) => m.methodId === methodId);
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
      await extractTokenTransfers(subtrace, tokenTransfers, methodIds);
    }
  }
}

function handleDynamicMethod(
  methodName: string,
  action: any,
  tokenTransfers: TokenTransfer[],
  trace: ITransactionTrace
) {
  switch (methodName) {
    case 'transfer':
      handleTransferMethod(action, tokenTransfers);
      break;

    case 'transferFrom':
      handleTransferFromMethod(action, tokenTransfers);
      break;

    case 'withdraw':
      handleUnwrapWethMethod(action, tokenTransfers);
      break;

    case 'wrap':
      handleWrapMethod(action, tokenTransfers);
      break;

    case 'mint':
      handleMintMethod(action, tokenTransfers);
      break;

    case 'burn':
    case 'customBurn':
    case 'burnFrom':
      handleBurnMethod(action, tokenTransfers);
      break;

    case 'add_liquidity':
      handleAddLiquidityMethod(action, trace, tokenTransfers);
      break;

    case 'deposit':
      // console.log("deposit", trace);
      break;

    // space for more cases
  }
}

/**
 * Merges token transfers from transaction traces with parsed events from a receipt,
 * placing new entries in the first array based on their position in the second array.
 *
 * @param tokenTransfersFromTransactionTraces - Array of token transfers from transaction traces.
 * @param parsedEventsFromReceipt - Array of parsed events (possibly including null or undefined elements).
 * @returns Array of TokenTransfer objects after merging and filtering.
 */
export function mergeAndFilterTransfers(
  tokenTransfersFromTransactionTraces: TokenTransfer[],
  parsedEventsFromReceipt: (ParsedEvent | null | undefined)[]
): TokenTransfer[] {
  // Filter out only transfer events from the parsed events
  const transferEventsFromReceipt = parsedEventsFromReceipt.filter((event) => event?.eventName === 'Transfer');

  // Iterate over each transfer event from the receipt
  transferEventsFromReceipt.forEach((event, index) => {
    if (event) {
      // Extract keys from the event object
      const keys = Object.keys(event);

      // Find a matching transfer in the tokenTransfersFromTransactionTraces
      const matchingTransfer = tokenTransfersFromTransactionTraces.find(
        (transfer) =>
          transfer.from.toLowerCase() === event[keys[0]].toLowerCase() &&
          transfer.to.toLowerCase() === event[keys[1]].toLowerCase() &&
          transfer.token.toLowerCase() === event.contractAddress.toLowerCase() &&
          transfer.value === event[keys[2]]
      );

      // If no matching transfer is found, create and insert a new transfer
      if (!matchingTransfer) {
        const newTransfer = {
          from: event[keys[0]],
          to: event[keys[1]],
          token: event[keys[3]],
          value: event[keys[2]],
        };

        // Insert at the same index as in parsedEventsFromReceipt, or push at the end if index is out of bounds
        if (index < tokenTransfersFromTransactionTraces.length) {
          tokenTransfersFromTransactionTraces.splice(index, 0, newTransfer);
        } else {
          tokenTransfersFromTransactionTraces.push(newTransfer);
        }
      }
    }
  });

  // Return the merged and reordered array of transfers
  return tokenTransfersFromTransactionTraces;
}

export function convertEventsToTransfers(parsedEventsFromReceipt: (ParsedEvent | null | undefined)[]): TokenTransfer[] {
  return parsedEventsFromReceipt
    .filter((event): event is ParsedEvent => !!event && event.eventName === 'Transfer')
    .map((event) => {
      const keys = Object.keys(event);

      return {
        from: event[keys[0]],
        to: event[keys[1]],
        token: event[keys[3]],
        value: event[keys[2]],
      };
    });
}
