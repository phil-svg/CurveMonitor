import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { TransactionType, Transactions } from "../../../models/Transactions.js";
import { Coins } from "../../../models/Coins.js";
import { TransactionDetails } from "../../../models/TransactionDetails.js";
import { EnrichedTransactionDetail } from "../../../Client.js";
import { getAddressById } from "./Pools.js";
import { getModifiedPoolName } from "../../api/utils/SearchBar.js";
import { getLabelNameFromAddress } from "./Labels.js";

export interface TransactionDetail {
  tx_id: number;
  pool_id: number;
  event_id?: number;
  tx_hash: string;
  block_number: number;
  block_unixtime: number;
  transaction_type: TransactionType;
  called_contract_by_user: string;
  trader: string;
  tx_position: number;
  coins_leaving_wallet: CoinDetail[];
  coins_entering_wallet: CoinDetail[];
}

export interface CoinDetail {
  coin_id: number;
  amount: number;
  name: string;
  address: string;
}

export async function txDetailEnrichment(txId: number): Promise<TransactionDetail | null> {
  const transaction = await Transactions.findOne({
    where: { tx_id: txId },
    include: [
      {
        model: TransactionCoins,
        include: [Coins],
      },
    ],
  });

  const transactionDetails = await TransactionDetails.findOne({
    where: { txId: txId },
  });

  if (!transaction || !transactionDetails) return null;

  const coinsLeavingWallet: CoinDetail[] = [];
  const coinsEnteringWallet: CoinDetail[] = [];

  for (const txCoin of transaction.transactionCoins) {
    const coinDetail: CoinDetail = {
      coin_id: txCoin.coin_id,
      amount: txCoin.amount,
      name: txCoin.coin.symbol!,
      address: txCoin.coin.address!,
    };
    txCoin.direction === "out" ? coinsLeavingWallet.push(coinDetail) : coinsEnteringWallet.push(coinDetail);
  }

  const txDetail: TransactionDetail = {
    tx_id: transaction.tx_id,
    pool_id: transaction.pool_id,
    event_id: transaction.event_id,
    tx_hash: transaction.tx_hash,
    block_number: transaction.block_number,
    block_unixtime: transaction.block_unixtime,
    transaction_type: transaction.transaction_type,
    called_contract_by_user: transactionDetails.to,
    trader: transactionDetails.from,
    tx_position: transaction.tx_position,
    coins_leaving_wallet: coinsLeavingWallet,
    coins_entering_wallet: coinsEnteringWallet,
  };

  return txDetail;
}

export async function enrichTransactionDetail(txId: number): Promise<EnrichedTransactionDetail | null> {
  const detailedTransaction = await txDetailEnrichment(txId);
  if (detailedTransaction) {
    let poolAddress = await getAddressById(detailedTransaction.pool_id);
    let poolName = await getModifiedPoolName(poolAddress!);
    let label = await getLabelNameFromAddress(detailedTransaction.called_contract_by_user);

    if (!label || label.startsWith("Contract Address")) {
      label = detailedTransaction.called_contract_by_user;
    }

    const enrichedTransaction: EnrichedTransactionDetail = {
      ...detailedTransaction,
      poolAddress: poolAddress!,
      poolName: poolName!,
      calledContractLabel: label,
    };

    return enrichedTransaction;
  } else {
    return null;
  }
}

export async function enrichTransactionDetailByTxHash(txHash: string): Promise<EnrichedTransactionDetail | null> {
  const transaction = await Transactions.findOne({ where: { tx_hash: txHash } });

  if (!transaction) {
    throw new Error(`No transaction found with hash: ${txHash}`);
  }

  const txId = transaction.tx_id;
  return await enrichTransactionDetail(txId);
}
