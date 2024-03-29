import { addNewTokenToDbFromCoinAddress } from "../../../Coins.js";
import { getCoinIdByAddress } from "../../../readFunctions/Coins.js";
import { NULL_ADDRESS, WETH_ADDRESS } from "../../../../helperFunctions/Constants.js";
import {
  addMissingETHWETHTransfers,
  getTokenTransfersFromTransactionTrace,
  makeTransfersReadable,
  removeDuplicatesAndUpdatePositions,
} from "../../../../txMap/TransferOverview.js";
// checking if a token, transferred in the tx, is stored in the db, if not, adding it.
export async function checkTokensInDatabase(tokenTransfers) {
  for (let transfer of tokenTransfers) {
    const coinId = await getCoinIdByAddress(transfer.token);
    if (coinId !== null) continue;
    await addNewTokenToDbFromCoinAddress(transfer.token);
  }
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
    } else if (isETHTransfer && addressesCount[transfer.from] > 1) {
      outflowingETH.push(transfer);
      return false;
    }
    return true;
  });
  return { inflowingETH, outflowingETH, remainingTransfers };
}
// LiquidityPairs = one deposit transfer, one lp-transfer OR one burn transfer, one fund-transfer.
function identifyLiquidityPairs(transfers) {
  const liquidityPairs = [];
  transfers.forEach((transfer, idx) => {
    if (transfer.from === NULL_ADDRESS) {
      // Looking for LP minting
      const possibleDepositPositions = [transfer.position - 1, transfer.position + 1];
      for (const possibleDepositTxPosition of possibleDepositPositions) {
        const depositTx = transfers.find(
          (tx) => tx.position === possibleDepositTxPosition && tx.from === transfer.to // Ensuring the depositor is also the LP mint's recipient
        );
        if (depositTx) {
          liquidityPairs.push([depositTx, transfer]);
          break;
        }
      }
    } else if (transfer.to === NULL_ADDRESS) {
      // Looking for LP burning
      const possibleWithdrawPositions = [transfer.position - 1, transfer.position + 1];
      for (const possibleWithdrawTxPosition of possibleWithdrawPositions) {
        const withdrawTx = transfers.find(
          (tx) => tx.position === possibleWithdrawTxPosition && tx.to === transfer.from // Ensuring the burner is also the recipient of the assets
        );
        if (withdrawTx) {
          liquidityPairs.push([transfer, withdrawTx]);
          break;
        }
      }
    }
  });
  const remainingTransfers = transfers.filter((transfer) => {
    return !liquidityPairs.flat().includes(transfer);
  });
  return { liquidityPairs, remainingTransfers };
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
      } else if (nextTransfer.from === currentTransfer.to && nextTransfer.to === swapSequence[0].from) {
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
function identifyEtherWrapsAndUnwraps(transfers) {
  const potentialWrapsAndUnwraps = transfers.filter(
    (transfer) => transfer.to.toLowerCase() === WETH_ADDRESS.toLowerCase() || transfer.from.toLowerCase() === WETH_ADDRESS.toLowerCase()
  );
  const etherWrapsAndUnwraps = [];
  let remainingTransfers = [...transfers];
  for (let i = 0; i < potentialWrapsAndUnwraps.length - 1; i++) {
    for (let j = i + 1; j < potentialWrapsAndUnwraps.length; j++) {
      const currentTransfer = potentialWrapsAndUnwraps[i];
      const potentialPairTransfer = potentialWrapsAndUnwraps[j];
      if (
        currentTransfer.from === potentialPairTransfer.to &&
        currentTransfer.to === potentialPairTransfer.from &&
        currentTransfer.parsedAmount === potentialPairTransfer.parsedAmount
      ) {
        etherWrapsAndUnwraps.push([currentTransfer, potentialPairTransfer]);
        remainingTransfers = remainingTransfers.filter((transfer) => transfer !== currentTransfer && transfer !== potentialPairTransfer);
        break;
      }
    }
  }
  return { etherWrapsAndUnwraps, remainingTransfers };
}
function identifyLiquidityEvents(transfers) {
  let remainingTransfers = [...transfers];
  const liquidityEvents = [];
  for (let i = 0; i < remainingTransfers.length - 1; i++) {
    const currentTransfer = remainingTransfers[i];
    const returnTransfers = remainingTransfers.filter(
      (transfer) => transfer.from === currentTransfer.to && transfer.to === currentTransfer.from && transfer.tokenAddress !== currentTransfer.tokenAddress
    );
    const uniqueTokens = new Set(returnTransfers.map((t) => t.tokenAddress));
    if (returnTransfers.length > 1 && uniqueTokens.size === returnTransfers.length) {
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
  // Identify Wraps and Unwraps first
  const { etherWrapsAndUnwraps, remainingTransfers: postWrapAndUnwrapTransfers } = identifyEtherWrapsAndUnwraps(transfers);
  const { liquidityEvents, remainingTransfers: postLiquidityEventTransfers } = identifyLiquidityEvents(postWrapAndUnwrapTransfers);
  const { swapPairs, remainingTransfers: postSwapTransfers } = identifySwapPairs(postLiquidityEventTransfers);
  const { inflowingETH, outflowingETH, remainingTransfers: postEthFlowTransfers } = categorizeEthFlows(postSwapTransfers, addressesThatAppearMultipleTimes);
  const { liquidityPairs, remainingTransfers: postliquidityPairsTransfers } = identifyLiquidityPairs(postEthFlowTransfers);
  const { isolatedTransfers, remainingTransfers: postIsolatedTransfers } = identifyIsolatedTransfers(postliquidityPairsTransfers);
  const { multiStepSwaps, remainingTransfers: postMultiStepTransfers } = identifyMultiStepSwaps(postIsolatedTransfers);
  const remainder = removeMultiStepSwaps(postMultiStepTransfers, multiStepSwaps);
  return {
    etherWrapsAndUnwraps,
    liquidityEvents,
    swaps: swapPairs,
    inflowingETH,
    outflowingETH,
    multiStepSwaps,
    liquidityPairs,
    isolatedTransfers,
    remainder,
  };
}
export async function getReadableTransfersFromTransactionTrace(transactionTraces) {
  const tokenTransfersFromTransactionTraces = await getTokenTransfersFromTransactionTrace(transactionTraces);
  // console.log("tokenTransfersFromTransactionTraces", tokenTransfersFromTransactionTraces);
  const readableTransfers = await makeTransfersReadable(tokenTransfersFromTransactionTraces);
  // console.log("readableTransfers", readableTransfers);
  return readableTransfers;
}
export async function getCategorizedTransfersFromTxTrace(transactionTraces) {
  const tokenTransfersFromTransactionTraces = await getTokenTransfersFromTransactionTrace(transactionTraces);
  // console.log("tokenTransfersFromTransactionTraces", tokenTransfersFromTransactionTraces);
  const readableTransfers = await makeTransfersReadable(tokenTransfersFromTransactionTraces);
  // console.log("readableTransfers", readableTransfers);
  const updatedReadableTransfers = addMissingETHWETHTransfers(readableTransfers);
  // console.log("updatedReadableTransfers", updatedReadableTransfers);
  const cleanedTransfers = removeDuplicatesAndUpdatePositions(updatedReadableTransfers);
  // console.log("cleanedTransfers", cleanedTransfers);
  const transfersCategorized = categorizeTransfers(cleanedTransfers);
  // console.dir(transfersCategorized, { depth: null, colors: true });
  return transfersCategorized;
}
//# sourceMappingURL=tokenMovementSolver.js.map
