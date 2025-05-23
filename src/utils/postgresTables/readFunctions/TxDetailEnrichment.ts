import { TransactionCoins } from '../../../models/TransactionCoins.js';
import { Transactions } from '../../../models/Transactions.js';
import { Coins } from '../../../models/Coins.js';
import { TransactionDetails } from '../../../models/TransactionDetails.js';
import { getAddressById, getAllPoolAddresses } from './Pools.js';
import { getModifiedPoolName } from '../../api/utils/SearchBar.js';
import { getLabelNameFromAddress } from './Labels.js';
import { getFromAddress } from './TransactionDetails.js';
import { getContractInceptionTimestamp } from './Contracts.js';
import { CoinDetail, EnrichedTransactionDetail, TransactionDetail } from '../../Interfaces.js';

export async function isCalledContractFromCurve_(detailedTransaction: TransactionDetail): Promise<boolean> {
  // Fetch all pool addresses.
  const allPoolAddresses: string[] = await getAllPoolAddresses();

  // Check if the called_contract_by_user address exists in allPoolAddresses (case-insensitive).
  return allPoolAddresses.some(
    (address) => address.toLowerCase() === detailedTransaction.called_contract_by_user.toLowerCase()
  );
}

export async function txDetailEnrichment(txId: number): Promise<TransactionDetail | null> {
  const transaction = await Transactions.findOne({
    where: { tx_id: txId },
    include: [
      {
        model: TransactionCoins,
        include: [Coins],
      },
      {
        model: TransactionDetails,
        as: 'transactionDetails',
      },
    ],
  });

  if (!transaction) {
    console.log('transaction missing in txDetailEnrichment for txId', txId);
    return null;
  }

  const transactionDetails = transaction.transactionDetails;
  if (!transactionDetails) {
    console.log('transactionDetails missing in txDetailEnrichment for txId', txId);
    return null;
  }

  const coinsLeavingWallet: CoinDetail[] = [];
  const coinsEnteringWallet: CoinDetail[] = [];

  for (const txCoin of transaction.transactionCoins) {
    const coinDetail: CoinDetail = {
      coin_id: txCoin.coin_id,
      amount: txCoin.amount,
      name: txCoin.coin.symbol!,
      address: txCoin.coin.address!,
    };
    txCoin.direction === 'out' ? coinsLeavingWallet.push(coinDetail) : coinsEnteringWallet.push(coinDetail);
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
    let calledContractInceptionTimestamp = await getContractInceptionTimestamp(
      detailedTransaction.called_contract_by_user
    );
    let isCalledContractFromCurve = await isCalledContractFromCurve_(detailedTransaction);

    if (!label || label.startsWith('Contract Address')) {
      label = detailedTransaction.called_contract_by_user;
    }

    let from = await getFromAddress(txId);

    const enrichedTransaction: EnrichedTransactionDetail = {
      ...detailedTransaction,
      poolAddress: poolAddress!,
      poolName: poolName!,
      calledContractLabel: label,
      from: from!,
      calledContractInceptionTimestamp: calledContractInceptionTimestamp!,
      isCalledContractFromCurve: isCalledContractFromCurve,
    };

    return enrichedTransaction;
  } else {
    console.log('detailedTransaction missing in enrichTransactionDetail for txId', txId);
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
