import { Op } from "sequelize";
import { Transactions } from "../../../models/Transactions.js";
import { getTimeframeTimestamp } from "../utils/Timeframes.js";
import { chunkedAsync } from "../../postgresTables/readFunctions/SandwichDetailEnrichments.js";
import { isCalledContractFromCurve_, txDetailEnrichment } from "../../postgresTables/readFunctions/TxDetailEnrichment.js";
import { getLabelNameFromAddress } from "../../postgresTables/readFunctions/Labels.js";
import { getFromAddress } from "../../postgresTables/readFunctions/TransactionDetails.js";
import { getContractInceptionTimestamp } from "../../postgresTables/readFunctions/Contracts.js";
import { EnrichedTransactionDetail } from "../../Interfaces.js";

export async function getTransactionIdsForPool(timeDuration: string, poolId: number, page: number = 1): Promise<{ ids: number[]; totalPages: number }> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;

  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const totalRecords = await Transactions.count({
    where: {
      pool_id: poolId,
      block_unixtime: {
        [Op.gte]: timeframeStartUnix,
      },
    },
  });

  const transactions = await Transactions.findAll({
    where: {
      pool_id: poolId,
      block_unixtime: {
        [Op.gte]: timeframeStartUnix,
      },
    },
    limit: recordsPerPage,
    offset: offset,
    order: [["block_unixtime", "DESC"]],
  });

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return { ids: transactions.map((transaction) => transaction.tx_id), totalPages };
}

export async function enrichTransactions(transactionIds: number[], poolAddress: string, poolName: string): Promise<EnrichedTransactionDetail[]> {
  const enrichedTransactions: (EnrichedTransactionDetail | null)[] = await chunkedAsync(transactionIds, 10, (txId) => TransactionDetailEnrichment(txId, poolAddress, poolName));
  const validTransactions: EnrichedTransactionDetail[] = enrichedTransactions.filter((transaction) => transaction !== null) as EnrichedTransactionDetail[];
  return validTransactions;
}

export async function TransactionDetailEnrichment(txId: number, poolAddress: string, poolName: string): Promise<EnrichedTransactionDetail | null> {
  const detailedTransaction = await txDetailEnrichment(txId);
  if (!detailedTransaction) return null;

  let label = await getLabelNameFromAddress(detailedTransaction.called_contract_by_user);
  if (!label || label.startsWith("Contract Address")) {
    label = detailedTransaction.called_contract_by_user;
  }

  let from = await getFromAddress(txId);
  let calledContractInceptionTimestamp = await getContractInceptionTimestamp(detailedTransaction.called_contract_by_user);

  let isCalledContractFromCurve = await isCalledContractFromCurve_(detailedTransaction);

  const enrichedTransaction: EnrichedTransactionDetail = {
    ...detailedTransaction,
    calledContractLabel: label,
    poolAddress: poolAddress,
    poolName: poolName,
    from: from!,
    calledContractInceptionTimestamp: calledContractInceptionTimestamp!,
    isCalledContractFromCurve: isCalledContractFromCurve,
  };

  return enrichedTransaction;
}
