import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { TransactionType, Transactions } from "../../../models/Transactions.js";
import { Coins } from "../../../models/Coins.js";
import { TransactionCalls } from "../../../models/TransactionCalls.js";

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

  const transactionCall = await TransactionCalls.findOne({
    where: { txId: txId },
  });

  if (!transaction || !transactionCall) return null;

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
    called_contract_by_user: transactionCall.called_address,
    trader: transaction.trader,
    tx_position: transaction.tx_position,
    coins_leaving_wallet: coinsLeavingWallet,
    coins_entering_wallet: coinsEnteringWallet,
  };

  return txDetail;
}
