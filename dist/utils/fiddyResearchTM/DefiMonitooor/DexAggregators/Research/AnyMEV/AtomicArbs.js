import { CoWProtocolGPv2Settlement, ETH_ADDRESS, WETH_ADDRESS } from '../../../../../helperFunctions/Constants.js';
import { botOrFromTransferToLeaf, filterTransfersByAddress, getBalanceChangeForAddressFromTransfers, hasAtLeastTwoPairs, hasEnoughSwaps, hasExternalTokenInflow, hasMissmatchingForOriginLeafesToTo, highestBlockPositionWorthChecking, is1InchInvolvedInTransfers, isAtomicArbCaseValueStaysWithFromOrTo, removeFalseDupes, toHasInflowFromLeafOtherThanFrom, wasDsProxy, } from '../../../../../postgresTables/mevDetection/atomic/utils/atomicArbDetection.js';
import { fetchAbiFromEtherscanForChain } from './CleanTransfersWOdb.js';
import { getTxFromTxHashAndProvider, getTxHashAtBlockPositionWithProvider } from '../../../../../web3Calls/generic.js';
async function checkCaseValueStaysWithFromOrToWOdb(cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to) {
    const txWasAtomicArb = isAtomicArbCaseValueStaysWithFromOrTo(cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to);
    if (!txWasAtomicArb) {
        return null;
    }
    //   const formattedArbitrage = await formatArbitrageCaseValueStaysWithFromOrTo(
    //     cleanedTransfers,
    //     txHash,
    //     transactionDetails,
    //     balanceChangeFrom,
    //     balanceChangeTo,
    //     from,
    //     to
    //   );
    const dummyArbitrageResult = {
        extractedValue: [
            {
                address: '0x123456789abcdef',
                symbol: 'ETH',
                amount: 1.5,
            },
            {
                address: '0xabcdef123456789',
                symbol: 'DAI',
                amount: 500,
            },
        ],
        bribe: {
            address: '0xbribe123456abcdef',
            symbol: 'BRIBE',
            amount: 100,
        },
        netWin: 'unknown',
        txGas: {
            gasUsed: 21000,
            gasPrice: 1000000000,
            gasCostETH: 0.021,
        },
        blockBuilder: null,
    };
    const formattedArbitrage = dummyArbitrageResult;
    return formattedArbitrage;
}
async function isAtomicArbCaseValueGoesOutsideFromOrToWOdb(onlyToTransfers, cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to) {
    if (balanceChangeFrom.length !== 0 || balanceChangeTo.length !== 0)
        return [false, 0];
    const filteredOnlyToTransfers = onlyToTransfers.filter((t) => t.from.toLowerCase() !== from.toLowerCase());
    if (filteredOnlyToTransfers.length === 0)
        return [false, 0];
    //   if (isLeaf(filteredOnlyToTransfers[0].from, cleanedTransfers.slice(1))) {
    //     const dollarValue = await getValueReceivedByLeaf(
    //       filteredOnlyToTransfers[0].tokenAddress,
    //       filteredOnlyToTransfers[0].parsedAmount,
    //       block_unixtime
    //     );
    //     if (!dollarValue) return [false, 0];
    //     return [true, dollarValue];
    //   }
    for (let i = cleanedTransfers.length - 1; i >= cleanedTransfers.length - 2; i--) {
        let transfer = cleanedTransfers[i];
        if (botOrFromTransferToLeaf(transfer, from, to, cleanedTransfers)) {
            // Last transfer matches
            if (i === cleanedTransfers.length - 1) {
                // Check the second-to-last transfer for the special case
                let secondToLastTransfer = cleanedTransfers[cleanedTransfers.length - 2];
                if (secondToLastTransfer.tokenAddress.toLowerCase() !== ETH_ADDRESS.toLowerCase() &&
                    secondToLastTransfer.tokenAddress.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
                    // If the second-to-last transfer is not ETH or WETH, continue checking
                    return [false, 0];
                }
            }
            return [true, 0];
        }
    }
    return [false, 0];
}
async function checkCaseValueGoesOutsideFromOrToWOdb(onlyToTransfers, cleanedTransfers, txHash, transactionDetails, balanceChangeFrom, balanceChangeTo, from, to
//): Promise<[FormattedArbitrageResult | null, number] | string> {
) {
    const [isAtomicArb, value] = await isAtomicArbCaseValueGoesOutsideFromOrToWOdb(onlyToTransfers, cleanedTransfers, balanceChangeFrom, balanceChangeTo, from, to);
    //   if (!isAtomicArb) {
    //     return [null, 0];
    //   }
    //   const formattedArbitrage = await formatArbitrageCaseValueGoesOutsideFromOrTo(
    //     cleanedTransfers,
    //     txHash,
    //     transactionDetails,
    //     from,
    //     to
    //   );
    //   return [formattedArbitrage, value];
    if (isAtomicArb)
        return 'isAtomicArb';
    return 'isNot';
}
async function isMakerProxyForChain(contractAddress, chain) {
    const abi = await fetchAbiFromEtherscanForChain(contractAddress, chain);
    if (!abi) {
        return false;
    }
    const requiredFunctions = ['cache', 'owner', 'authority'];
    return requiredFunctions.every((funcName) => abi.some((item) => item.type === 'function' && item.name === funcName && item.stateMutability === 'view'));
}
export async function isGlobalBackrunForChainFuzzyWOdb(blockNumber, txPosition, from, web3HttpProvider) {
    if (txPosition <= 1)
        return false;
    const previousTxHash = await getTxHashAtBlockPositionWithProvider(blockNumber, txPosition - 2, web3HttpProvider);
    if (!previousTxHash)
        return null;
    const previousTx = await getTxFromTxHashAndProvider(previousTxHash, web3HttpProvider);
    if (!previousTx)
        return null;
    // comparing the senders
    if (!previousTx.to)
        return false;
    if (previousTx.to.toLowerCase() !== from.toLowerCase())
        return false;
    // at this point we have two tx with a gap of one, where both are done by the same address.
    // next is checking if the first one is a frontrun.
    return true; // fuzzy
    //   const transactionTraces = await getTransactionTraceFromDb(previousTxHash);
    //   if (!transactionTraces || transactionTraces.length === 0) {
    //     const transactionTrace = await getTransactionTraceViaWeb3Provider(previousTxHash);
    //     await saveTransactionTrace(previousTxHash, transactionTrace);
    //   }
    //   const receipt = await getShortenReceiptByTxHash(previousTxHash);
    //   if (!receipt) {
    //     await fetchAndSaveReceipt(previousTxHash, txId);
    //   }
    //   const transactionDetails = await getTxFromTxHash(previousTxHash);
    //   if (!transactionDetails) return null;
    //   const { from: from, to: to } = extractTransactionAddresses(transactionDetails);
    //   if (!from || !to) return null;
    //   const cleanedTransfers = await getCleanedTransfers(previousTxHash, to);
    //   if (!cleanedTransfers) return null;
    //   const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);
    //   if (hasRelevantNegativeBalanceChange(balanceChangeTo)) {
    //     return true;
    //   } else {
    //     return false;
    //   }
}
export async function solveAtomicArbWOdbForChain(txHash, cleanedTransfers, from, to, position, txDetails, chain, web3HttpProvider) {
    const blockNumber = txDetails.blockNumber;
    const txPosition = txDetails.transactionIndex;
    const txHasAtLeastTwoPairs = hasAtLeastTwoPairs(cleanedTransfers);
    if (!txHasAtLeastTwoPairs) {
        return 'not an arb';
    }
    const OneInchInvolvedInTransfers = is1InchInvolvedInTransfers(cleanedTransfers);
    if (OneInchInvolvedInTransfers) {
        return 'not an arb';
    }
    const onlyToTransfers = filterTransfersByAddress(cleanedTransfers, to);
    if (!onlyToTransfers) {
        return null;
    }
    if (!onlyToTransfers.some((t) => t.position <= 5)) {
        return 'not an arb';
    }
    if (onlyToTransfers.length <= 2) {
        return 'not an arb';
    }
    const txWasDsProxy = wasDsProxy(cleanedTransfers);
    if (txWasDsProxy) {
        return 'not an arb';
    }
    if (hasMissmatchingForOriginLeafesToTo(onlyToTransfers, cleanedTransfers, from)) {
        return 'not an arb';
    }
    if (toHasInflowFromLeafOtherThanFrom(cleanedTransfers, from, to)) {
        return 'not an arb';
    }
    cleanedTransfers = removeFalseDupes(cleanedTransfers, from);
    const balanceChangeFrom = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);
    const balanceChangeTo = await getBalanceChangeForAddressFromTransfers(to, cleanedTransfers);
    if (!hasEnoughSwaps(balanceChangeTo, cleanedTransfers)) {
        return 'not an arb';
    }
    if (balanceChangeTo.length > 8) {
        return 'not an arb';
    }
    if (to.toLowerCase() === CoWProtocolGPv2Settlement.toLowerCase()) {
        return 'not an arb';
    }
    if (hasExternalTokenInflow(onlyToTransfers, to, from)) {
        return 'not an arb';
    }
    if (position > highestBlockPositionWorthChecking) {
        return 'not an arb';
    }
    let isArb = '';
    // Case 1: checking for the atomic arb case in which the profit stays in the bot/bot-operator system
    // Case 2: as in: is not checking for the atomic arb case in which the profit gets forwarded to a 3rd address
    // checking case 1
    let formattedArbitrage = await checkCaseValueStaysWithFromOrToWOdb(cleanedTransfers, txHash, txDetails, balanceChangeFrom, balanceChangeTo, from, to);
    let usdValuedArbitrageResult;
    let revenueStorageLocationCase;
    /*
      this dollar Value is storing the usd value,
      in case there was a value transfer in the first transfer from a leaf to toAddress
      */
    let dollarValueInflowFromLeaf = 0;
    // (If case 1)
    if (formattedArbitrage) {
        // usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
        revenueStorageLocationCase = 1;
    }
    else {
        // If it is not case 1, check for case 2
        // [formattedArbitrage, dollarValueInflowFromLeaf] = await checkCaseValueGoesOutsideFromOrToWOdb(
        //   onlyToTransfers,
        //   cleanedTransfers,
        //   txHash,
        //   txDetails,
        //   balanceChangeFrom,
        //   balanceChangeTo,
        //   from,
        //   to,
        //   block_unixtime
        // );
        isArb = await checkCaseValueGoesOutsideFromOrToWOdb(onlyToTransfers, cleanedTransfers, txHash, txDetails, balanceChangeFrom, balanceChangeTo, from, to);
        // if (formattedArbitrage) {
        //   usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
        //     formattedArbitrage,
        //     block_unixtime
        //   );
        //   revenueStorageLocationCase = 2;
        // }
        // if (isArb === 'isAtomicArb') {
        //   usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
        //     formattedArbitrage,
        //     block_unixtime
        //   );
        //   revenueStorageLocationCase = 2;
        // }
    }
    // if formattedArbitrage is empty after checking for both cases, it is not an atomic arbitrage.
    if (!formattedArbitrage && isArb !== 'isAtomicArb') {
        // console.log("Not Atomic Arbitrage!");
        return 'not an arb';
    }
    //   if (!usdValuedArbitrageResult) {
    //     return 'not an arb';
    //   }
    /*
    // checking for the case in which there was a bribe, and the rev went to an external address as well
    formattedArbitrage = testOtherBribePath(usdValuedArbitrageResult, cleanedTransfers, from, to, formattedArbitrage);
  
    if (revenueStorageLocationCase === 1) {
      usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueStaysWithFromOrTo(formattedArbitrage, block_unixtime);
    } else if (revenueStorageLocationCase === 2) {
      usdValuedArbitrageResult = await augmentWithUSDValuesCaseValueGoesOutsideFromOrTo(
        formattedArbitrage,
        block_unixtime
      );
    } else {
      console.log('something funny with revenueStorageLocationCase');
      return null;
    }
    */
    //   if (!usdValuedArbitrageResult) {
    //     // console.log("Skipping usdValuedArbitrageResult due to failed price fetching.");
    //     return 'not an arb';
    //   }
    // 68 ms
    if (await isMakerProxyForChain(to, chain)) {
        return 'not an arb';
    }
    // 600 ms
    const isBackrun = await isGlobalBackrunForChainFuzzyWOdb(blockNumber, txPosition, from, web3HttpProvider);
    if (isBackrun) {
        // at this point we can be sure we found a sandwich, in which only the backrun went at some point through a curve pool,
        // , but the frontrun and the victim tx never did.
        return 'not an arb';
    }
    // an arb
    return 'arb';
    // console.log("\n\nusdValuedArbitrageResult:", usdValuedArbitrageResult, "\nid", txId, "\ntxHash", txHash);
    //   const profitDetails = calculateProfitDetails(usdValuedArbitrageResult, dollarValueInflowFromLeaf);
    //   if (!profitDetails) {
    //     console.log('!profitDetails in solveAtomicArb');
    //     return null;
    //   }
    //   let validatorPayOffInEth: number | null = null;
    //   let validatorPayOffInUSD: number | null = null;
    //   if (profitDetails.bribe) {
    //     validatorPayOffInEth = await getValidatorPayOff(txHash);
    //     if (validatorPayOffInEth && usdValuedArbitrageResult.ethPrice) {
    //       validatorPayOffInUSD = validatorPayOffInEth * usdValuedArbitrageResult.ethPrice;
    //     }
    //   }
    // 57 ms
    //   const atomicArbDetails = await buildAtomicArbDetails(txId, profitDetails, validatorPayOffInUSD);
    //   if (!atomicArbDetails) {
    //     console.log('!atomicArbDetails in solveAtomicArb');
    //     return null;
    //   }
    // return atomicArbDetails;
}
//# sourceMappingURL=AtomicArbs.js.map