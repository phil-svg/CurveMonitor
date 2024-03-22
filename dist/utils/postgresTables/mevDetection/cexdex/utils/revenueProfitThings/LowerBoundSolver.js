import { filterSmallAmountsFromCleanedTransfers, getCleanedTransfersForTxIdFromTable } from "../../../../readFunctions/CleanedTransfers.js";
import { getEthPriceWithTimestampFromTable } from "../../../../readFunctions/PriceMap.js";
import { getTransactionDetailsByTxId } from "../../../../readFunctions/TransactionDetails.js";
import { getTxHashByTxId, getUnixTimestampByTxId } from "../../../../readFunctions/Transactions.js";
import { calculateGasInfo, getLeafEthTransfers } from "../../../atomic/utils/atomicArbDetection.js";
export async function getBlockBuilderFromFromAndTo(txId, from, to) {
    let cleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
    if (!cleanedTransfers)
        return null;
    const ethLeafTransfers = getLeafEthTransfers(cleanedTransfers, from, to);
    if (ethLeafTransfers.length === 0) {
        return null;
    }
    else {
        return ethLeafTransfers[ethLeafTransfers.length - 1].to;
    }
}
function getBribeInEth(transfers) {
    if (transfers.length === 0) {
        return null;
    }
    const lastTransfer = transfers[transfers.length - 1];
    if (lastTransfer.tokenSymbol !== "ETH") {
        return null;
    }
    const isUniqueAddress = !transfers.slice(0, -1).some((transfer) => transfer.from === lastTransfer.to || transfer.to === lastTransfer.to);
    if (isUniqueAddress) {
        return lastTransfer.parsedAmount;
    }
    else {
        return null;
    }
}
export async function getBribeInUSDfromTx(txId) {
    const fullCleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
    if (!fullCleanedTransfers)
        return null;
    const cleanTransfers = filterSmallAmountsFromCleanedTransfers(fullCleanedTransfers);
    const bribeInEth = getBribeInEth(cleanTransfers);
    if (!bribeInEth)
        return null;
    const unixtime = await getUnixTimestampByTxId(txId);
    if (!unixtime)
        return null;
    const ethPriceAtThatTime = await getEthPriceWithTimestampFromTable(unixtime);
    if (!ethPriceAtThatTime)
        return null;
    return bribeInEth * ethPriceAtThatTime;
}
export async function getGasSpendingsInUSDfromTx(txId) {
    const txHash = await getTxHashByTxId(txId);
    if (!txHash)
        return null;
    const transactionDetails = await getTransactionDetailsByTxId(txId);
    if (!transactionDetails)
        return null;
    const { gasUsed, gasPrice, gasCostETH } = await calculateGasInfo(txHash, transactionDetails);
    const unixtime = await getUnixTimestampByTxId(txId);
    if (!unixtime)
        return null;
    const ethPriceAtThatTime = await getEthPriceWithTimestampFromTable(unixtime);
    if (!ethPriceAtThatTime)
        return null;
    const gasSpendingsInUSD = ethPriceAtThatTime * gasCostETH;
    return gasSpendingsInUSD;
}
export async function solveRevenueLowerBoundInUSD(txId) {
    let gasMoney = await getGasSpendingsInUSDfromTx(txId);
    if (!gasMoney)
        gasMoney = 0;
    let bribeMoney = await getBribeInUSDfromTx(txId);
    if (!bribeMoney)
        bribeMoney = 0;
    const revenueLowerBound = Number((gasMoney + bribeMoney).toFixed(2));
    return revenueLowerBound;
}
//# sourceMappingURL=LowerBoundSolver.js.map