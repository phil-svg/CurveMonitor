import { filterSmallAmountsFromCleanedTransfers, getCleanedTransfersForTxIdFromTable, getTransferArrLengthForTxId, } from '../../../readFunctions/CleanedTransfers.js';
import { isActuallyBackrun } from '../../../readFunctions/Sandwiches.js';
import { extractTransactionAddresses, getToAddress, getTransactionDetails, getTransactionDetailsByTxId, } from '../../../readFunctions/TransactionDetails.js';
import { whitelistedAddress } from './Constants.js';
import { getTxHashByTxId, getUnixTimestampByTxId } from '../../../readFunctions/Transactions.js';
import { readAbiFromAbisEthereumTable } from '../../../readFunctions/Abi.js';
import { calculateGasInfo } from '../../atomic/utils/atomicArbDetection.js';
import { getBribeInUSDfromTx } from './revenueProfitThings/LowerBoundSolver.js';
import { getEthPriceWithTimestampFromTable } from '../../../readFunctions/PriceMap.js';
import { ETH_ADDRESS, WETH_ADDRESS } from '../../../../helperFunctions/Constants.js';
import { getAllPoolAddresses } from '../../../readFunctions/Pools.js';
function hasIllegalOutbound(from, to, cleanedTransfers) {
    const lowerCaseFrom = from.toLowerCase();
    const lowerCaseTo = to.toLowerCase();
    return cleanedTransfers.some((transfer) => transfer.from.toLowerCase() === lowerCaseFrom &&
        (transfer.to.toLowerCase() !== lowerCaseTo || transfer.tokenSymbol !== 'ETH'));
}
export function addressIsWhitelisted(to) {
    return whitelistedAddress.some((whitelisted) => whitelisted.address.toLowerCase() === to.toLowerCase());
}
export async function wasPoolCalledDirectly(txId, to) {
    const allPoolAddresses = await getAllPoolAddresses();
    const toLower = to.toLowerCase();
    // Check if 'to' address exists in the list of all pool addresses (case-insensitive)
    const isDirectCall = allPoolAddresses.some((address) => address.toLowerCase() === toLower);
    return isDirectCall;
}
export async function isCexDexArbCandidate(txId, numOfTransfers) {
    // Fetch transaction details
    const transactionDetails = await getTransactionDetails(txId);
    if (!transactionDetails) {
        console.log('Transaction details are missing for txId', txId);
        return false;
    }
    // Extract from and to addresses
    const { from, to } = extractTransactionAddresses(transactionDetails);
    if (!from || !to) {
        console.log(`Failed to extract addresses for txId ${txId}`);
        return false;
    }
    // Fetch cleaned transfers for the transaction
    const cleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
    if (!cleanedTransfers) {
        console.log('Cleaned transfers are missing for txId', txId);
        return false;
    }
    if (hasIllegalOutbound(from, to, cleanedTransfers))
        return false;
    // Define the logic for numOfTransfers
    switch (numOfTransfers) {
        case 2:
            return true; // If there are exactly two transfers, return true
        case 3:
            // Check if "to" either received ETH from "from" address or sent ETH to a leaf address
            return cleanedTransfers.some((transfer) => transfer.tokenSymbol === 'ETH' &&
                ((transfer.from.toLowerCase() === from.toLowerCase() && transfer.to.toLowerCase() === to.toLowerCase()) ||
                    (transfer.from.toLowerCase() === to.toLowerCase() && isLeafAddress(transfer.to, cleanedTransfers))));
        case 4:
            // Check if the other two transfers are ETH, and one is sent to "to" from "from", and one is "to" sending ETH to leaf
            const ethTransfers = cleanedTransfers.filter((transfer) => transfer.tokenSymbol === 'ETH');
            return (ethTransfers.some((transfer) => transfer.from.toLowerCase() === from.toLowerCase() && transfer.to.toLowerCase() === to.toLowerCase()) &&
                ethTransfers.some((transfer) => transfer.from.toLowerCase() === to.toLowerCase() && isLeafAddress(transfer.to, cleanedTransfers)));
        default:
            return false; // If none of the above cases match, return false
    }
}
function removeEthWrapsAndUnwraps(cleanedTransfers) {
    const hasInvalidTransfer = cleanedTransfers.some((transfer) => transfer.from == null || transfer.to == null);
    if (hasInvalidTransfer)
        return cleanedTransfers;
    // Remove all transfers with from or to being WETH_ADDRESS
    const filteredTransfers = cleanedTransfers.filter((transfer) => transfer.from.toLowerCase() !== WETH_ADDRESS.toLowerCase() &&
        transfer.to.toLowerCase() !== WETH_ADDRESS.toLowerCase());
    // Convert remaining WETH transfers to ETH
    const convertedTransfers = filteredTransfers.map((transfer) => {
        if (transfer.tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
            return Object.assign(Object.assign({}, transfer), { tokenSymbol: 'ETH', tokenAddress: ETH_ADDRESS });
        }
        else {
            return transfer;
        }
    });
    return convertedTransfers;
}
function isLeafAddress(address, cleanedTransfers) {
    const lowerCaseAddress = address.toLowerCase();
    const occurrences = cleanedTransfers.reduce((acc, transfer) => {
        if (transfer.from.toLowerCase() === lowerCaseAddress || transfer.to.toLowerCase() === lowerCaseAddress) {
            acc += 1;
        }
        return acc;
    }, 0);
    return occurrences === 1;
}
export async function isCexDexArb(txId) {
    let numOfTransfers = await getTransferArrLengthForTxId(txId);
    if (!numOfTransfers)
        return 'unable to fetch';
    if (numOfTransfers < 10) {
        let cleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
        if (!cleanedTransfers)
            return 'unable to fetch';
        cleanedTransfers = filterSmallAmountsFromCleanedTransfers(cleanedTransfers);
        cleanedTransfers = removeEthWrapsAndUnwraps(cleanedTransfers);
        numOfTransfers = cleanedTransfers.length;
    }
    if (numOfTransfers > 4)
        return false;
    const to = await getToAddress(txId);
    if (!to)
        return 'unable to fetch';
    if (addressIsWhitelisted(to))
        return false;
    if (await wasPoolCalledDirectly(txId, to))
        return false;
    if (!(await isCexDexArbCandidate(txId, numOfTransfers)))
        return false;
    if (await isActuallyBackrun(txId))
        return false;
    if (await readAbiFromAbisEthereumTable(to))
        return false;
    // If all checks have passed, return true
    return true;
}
export async function getEnrichedCexDexDetails(enrichedTransaction) {
    // const eoaAddress = enrichedTransaction.from;
    const txId = enrichedTransaction.tx_id;
    // const eoaNonce = await getNonceWithLimiter(eoaAddress);
    // if (!eoaNonce) {
    //   console.log(`Unable to get EOA nonce in getNonceWithLimiter for address: ${eoaAddress}`);
    //   return null;
    // }
    const txHash = await getTxHashByTxId(txId);
    if (!txHash) {
        console.log(`Unable to get transaction hash in getTxHashByTxId for txId: ${txId}`);
        return null;
    }
    // const builder = await getBlockBuilderAddress(txHash);
    // if (!builder) {
    //   console.log(`Unable to get block builder in getBlockBuilderFromFromAndTo for txId: ${txId}`);
    //   return null;
    // }
    const transactionDetails = await getTransactionDetailsByTxId(txId);
    if (!transactionDetails) {
        console.log(`Unable to get transaction details in getTransactionDetailsByTxId for txHash: ${txHash}`);
        return null;
    }
    const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);
    const unixtime = await getUnixTimestampByTxId(txId);
    if (!unixtime) {
        console.log(`Unable to get Unix timestamp in calculateGasInfo for txId: ${txId}`);
        return null;
    }
    const ethPriceAtThatTime = await getEthPriceWithTimestampFromTable(unixtime);
    if (!ethPriceAtThatTime) {
        console.log(`Unable to get ETH price at given time in getEthPriceWithTimestampFromTable for unixtime: ${unixtime}`);
        return null;
    }
    // const blockPayoutETH = await getValidatorPayOff(txHash);
    // if (!blockPayoutETH) {
    //   console.log(`Unable to get validator payoff in getValidatorPayOff for txHash: ${txHash}`);
    //   return null;
    // }
    // const blockPayoutUSD = blockPayoutETH * ethPriceAtThatTime;
    const gasCostUSD = ethPriceAtThatTime * gasCostETH;
    let bribeInUSD = await getBribeInUSDfromTx(txId);
    if (!bribeInUSD)
        bribeInUSD = 0;
    let totalTxCostInUSD;
    if (bribeInUSD) {
        totalTxCostInUSD = bribeInUSD + gasCostETH;
    }
    else {
        totalTxCostInUSD = gasCostETH;
    }
    const gasInGwei = gasPrice;
    const enrichedCexDexDetails = Object.assign(Object.assign({}, enrichedTransaction), { 
        //builder: builder,
        // blockPayoutETH: blockPayoutETH,
        // blockPayoutUSD: blockPayoutUSD,
        // eoaNonce: eoaNonce,
        gasInGwei: gasInGwei, gasCostUSD: gasCostUSD, bribeInUSD: bribeInUSD });
    return enrichedCexDexDetails;
}
//# sourceMappingURL=cexdexDetection.js.map