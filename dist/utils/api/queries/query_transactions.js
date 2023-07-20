import { Op } from "sequelize";
import { Transactions } from "../../../models/Transactions.js";
import { getTimeframeTimestamp } from "../utils/Timeframes.js";
import { chunkedAsync } from "../../postgresTables/readFunctions/SandwichDetailEnrichments.js";
import { txDetailEnrichment } from "../../postgresTables/readFunctions/TxDetailEnrichment.js";
import { getLabelNameFromAddress } from "../../postgresTables/readFunctions/Labels.js";
export async function getTransactionIdsForPool(timeDuration, poolId) {
    const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    const transactions = await Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: timeframeStartUnix,
            },
        },
    });
    // Return an array of transaction IDs
    return transactions.map((transaction) => transaction.tx_id);
}
export async function enrichTransactions(transactionIds, poolAddress, poolName) {
    const enrichedTransactions = await chunkedAsync(transactionIds, 10, (txId) => TransactionDetailEnrichment(txId, poolAddress, poolName));
    const validTransactions = enrichedTransactions.filter((transaction) => transaction !== null);
    return validTransactions;
}
export async function TransactionDetailEnrichment(txId, poolAddress, poolName) {
    const detailedTransaction = await txDetailEnrichment(txId);
    if (!detailedTransaction)
        return null;
    let label = await getLabelNameFromAddress(detailedTransaction.called_contract_by_user);
    if (!label || label.startsWith("Contract Address")) {
        label = detailedTransaction.called_contract_by_user;
    }
    const enrichedTransaction = Object.assign(Object.assign({}, detailedTransaction), { calledContractLabel: label, poolAddress: poolAddress, poolName: poolName });
    return enrichedTransaction;
}
//# sourceMappingURL=query_transactions.js.map