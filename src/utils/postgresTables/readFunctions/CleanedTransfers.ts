import { TokenTransfers } from '../../../models/CleanedTransfers.js';
import { Coins } from '../../../models/Coins.js';
import { ReadableTokenTransfer } from '../../Interfaces.js';
import { getToAddress } from './TransactionDetails.js';
import { getTxIdByTxHash } from './Transactions.js';

export async function getAllTxIdsFromCleanedTransfers(): Promise<number[]> {
  try {
    const tokenTransfers = await TokenTransfers.findAll({
      attributes: ['tx_id'],
      raw: true,
    });

    const txIds = tokenTransfers.map((transfer) => transfer.tx_id);
    return txIds;
  } catch (error) {
    console.error('Error retrieving tx_ids:', error);
    return [];
  }
}

export async function getTransferArrLengthForTxId(txId: number): Promise<number | null> {
  try {
    const tokenTransferEntry = await TokenTransfers.findOne({
      where: { tx_id: txId },
      attributes: ['cleaned_transfers'],
      raw: true,
    });

    if (tokenTransferEntry && tokenTransferEntry.cleaned_transfers) {
      return tokenTransferEntry.cleaned_transfers.length;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error retrieving cleaned_transfers length:', error);
    return null;
  }
}

export async function getCleanedTransfersForTxIdFromTable(txId: number): Promise<ReadableTokenTransfer[] | null> {
  try {
    const tokenTransferEntry = await TokenTransfers.findOne({
      where: { tx_id: txId },
      attributes: ['cleaned_transfers'],
    });
    return tokenTransferEntry ? tokenTransferEntry.cleaned_transfers : null;
  } catch (error) {
    console.error(`Error fetching cleaned transfers for txId ${txId}:`, error);
    return null;
  }
}

export async function getCleanedTransfersForTxHashFromTable(txHash: string): Promise<ReadableTokenTransfer[] | null> {
  const txId = await getTxIdByTxHash(txHash);
  if (!txId) {
    return null;
  }
  try {
    const tokenTransferEntry = await TokenTransfers.findOne({
      where: { tx_id: txId },
      attributes: ['cleaned_transfers'],
    });
    return tokenTransferEntry ? tokenTransferEntry.cleaned_transfers : null;
  } catch (error) {
    console.error(`Error fetching cleaned transfers for txId ${txId}:`, error);
    return null;
  }
}

export function filterSmallAmountsFromCleanedTransfers(transfers: ReadableTokenTransfer[]): ReadableTokenTransfer[] {
  const AMOUNT_THRESHOLD = 1e-7;
  return transfers.filter((transfer) => transfer.parsedAmount >= AMOUNT_THRESHOLD);
}

interface TokenSums {
  [token: string]: number;
}

export async function sumOutgoingTransfersByToken(txIds: number[]): Promise<TokenSums> {
  let tokenSums: TokenSums = {};

  for (const txId of txIds) {
    const toAddress = await getToAddress(txId);
    if (!toAddress) {
      continue; // Skip if 'to' address is not found
    }

    const tokenTransferEntry = await TokenTransfers.findOne({
      where: { tx_id: txId },
    });

    if (!tokenTransferEntry || !tokenTransferEntry.cleaned_transfers) {
      continue; // Skip if no token transfer entry or cleaned_transfers found
    }

    const outgoingTransfers = tokenTransferEntry.cleaned_transfers.filter(
      (transfer) => transfer.from.toLowerCase() === toAddress.toLowerCase()
    );

    if (outgoingTransfers.length === 2) {
      // Find the transfer with the lower amount
      const lowerAmountTransfer = outgoingTransfers.reduce((prev, current) =>
        prev.parsedAmount < current.parsedAmount ? prev : current
      );

      const tokenSymbol = lowerAmountTransfer.tokenSymbol || 'Unknown';
      const amount = lowerAmountTransfer.parsedAmount;

      tokenSums[tokenSymbol] = (tokenSums[tokenSymbol] || 0) + amount;

      // Check for ETH transfers greater than 0.5
      if (tokenSymbol === 'ETH' && amount > 0.5) {
        console.log(`Transaction with more than 0.5 ETH: TxHash - ${tokenTransferEntry.transaction.tx_hash}`);
      }
    }
  }

  return tokenSums;
}
