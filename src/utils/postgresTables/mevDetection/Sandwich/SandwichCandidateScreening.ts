import { ExtendedTransactionData } from '../../../Interfaces.js';
import { calcTheLossOfCurveUserFromSandwich, saveSandwich } from './SandwichUtils.js';
import { Transactions } from '../../../../models/Transactions.js';
import { eventFlags } from '../../../api/utils/EventFlags.js';
import eventEmitter from '../../../goingLive/EventEmitter.js';
import { Sandwiches } from '../../../../models/Sandwiches.js';
import { priceTransaction } from '../../../TokenPrices/txValue/PriceTransaction.js';
import { updateSandwichFlagForSingleTx } from './SandwichDetection.js';

/**
 * Function: getBotTransactions
 *
 * Description:
 * This function takes an array of transaction data objects (`ExtendedTransactionData[]`) as input.
 * The goal is to identify and return an array of potential bot transactions in pairs.
 *
 * Detailed Process:
 * 1. The input transactions are sorted by `tx_position` to ensure chronological order.
 * 2. The function then loops through each transaction, comparing it with every other transaction in the sorted array.
 * 3. A pair of transactions is only considered if they have the same trader and both are swap transactions. This is based on the assumption that a potential bot operation could involve a pair of swap transactions from the same trader.
 * 4. If such a pair of transactions is identified, the function examines the 'in' and 'out' coins for each transaction. The bot activity pattern it looks for is swapping CoinA for CoinB in the first transaction, then swapping CoinB back for CoinA in the second transaction.
 * 5. If this pattern is identified in a pair of transactions, both transactions are added to the `potentialBotTx` array as a pair.
 * 6. The function finally returns the `potentialBotTx` array, containing all identified potential bot transactions in pairs.
 *
 * Parameters:
 * @param {ExtendedTransactionData[]} candidate - Array of transaction data objects to screen for potential bot activity.
 *
 * Returns:
 * @returns {Promise<ExtendedTransactionData[][]>} - An array of pairs of transaction data objects identified as potential bot transactions.
 */
async function getBotTransactions(candidate: ExtendedTransactionData[]): Promise<ExtendedTransactionData[][]> {
  let potentialBotTx: ExtendedTransactionData[][] = [];

  // Sort the candidate array by tx_position
  candidate.sort((a, b) => a.tx_position - b.tx_position);

  // Iterate over the transactions
  for (let i = 0; i < candidate.length; i++) {
    for (let j = i + 1; j < candidate.length; j++) {
      const tx1 = candidate[i];
      const tx2 = candidate[j];

      // Check if the transactions have the same trader and are both swaps
      if (tx1.trader === tx2.trader && tx1.transaction_type === 'swap' && tx2.transaction_type === 'swap') {
        const tx1InCoin = tx1.transactionCoins.find((coin) => coin.direction === 'in');
        const tx1OutCoin = tx1.transactionCoins.find((coin) => coin.direction === 'out');
        const tx2InCoin = tx2.transactionCoins.find((coin) => coin.direction === 'in');
        const tx2OutCoin = tx2.transactionCoins.find((coin) => coin.direction === 'out');

        // Check if the trade route was coinA -> coinB, then coinB -> coinA
        if (tx1InCoin && tx1OutCoin && tx2InCoin && tx2OutCoin) {
          if (tx1InCoin.coin_id === tx2OutCoin.coin_id && tx1OutCoin.coin_id === tx2InCoin.coin_id) {
            potentialBotTx.push([tx1, tx2]);
          }
        }
      }
    }
  }

  // sorting out the case in which the same address (bot) backrunned twice! (one time from within the sandwich, one time from external dex)
  if (potentialBotTx.length > 1) {
    // Create a map to group the pairs by the frontrun transaction's tx_position
    const groupedByFrontrun: Record<number, ExtendedTransactionData[][]> = {};

    for (const pair of potentialBotTx) {
      const frontrunTxPosition = pair[0].tx_position;
      if (!groupedByFrontrun[frontrunTxPosition]) {
        groupedByFrontrun[frontrunTxPosition] = [];
      }
      groupedByFrontrun[frontrunTxPosition].push(pair);
    }

    // Refine the pairs by keeping only the one with the smallest backrun tx_position for each group
    potentialBotTx = [];
    for (const key in groupedByFrontrun) {
      const group = groupedByFrontrun[key];
      if (group.length > 1) {
        group.sort((a, b) => a[1].tx_position - b[1].tx_position); // Sort by backrun tx_position
        potentialBotTx.push(group[0]); // Keep the pair with the smallest backrun tx_position
      } else {
        potentialBotTx.push(group[0]);
      }
    }
  }

  return potentialBotTx;
}

/**
 * Function: findPotentialLossTransactions
 *
 * Description:
 * This function takes two arrays of transaction data objects (`botTransaction` and `candidate`) as input.
 * The goal is to identify and return an array of transactions from `candidate` that have a `tx_position` between
 * the `tx_positions` of the two bot transactions.
 *
 * Detailed Process:
 * 1. The function first verifies that the `botTransaction` array contains exactly two transactions.
 * 2. The function then loops over the `candidate` array and checks the `tx_position` of each transaction.
 * 3. If a transaction's `tx_position` is greater than the `tx_position` of the first bot transaction and less than
 * the `tx_position` of the second bot transaction, the transaction is added to the `potentialLossTx` array.
 * 4. The function finally returns the `potentialLossTx` array, containing all identified potential loss transactions.
 *
 * Parameters:
 * @param {ExtendedTransactionData[]} botTransaction - Array containing exactly two bot transactions.
 * @param {ExtendedTransactionData[]} candidate - Array of transaction data objects to screen for potential loss activity.
 *
 * Returns:
 * @returns {Promise<ExtendedTransactionData[]>} - An array of transaction data objects identified as potential loss transactions.
 */
async function findPotentialLossTransactions(
  botTransaction: ExtendedTransactionData[],
  candidate: ExtendedTransactionData[]
): Promise<ExtendedTransactionData[]> {
  if (botTransaction.length !== 2) {
    throw new Error('botTransaction array must contain exactly two transactions');
  }

  let potentialLossTx: ExtendedTransactionData[] = [];

  let botTxPosition1 = botTransaction[0].tx_position;
  let botTxPosition2 = botTransaction[1].tx_position;

  for (let i = 0; i < candidate.length; i++) {
    const tx = candidate[i];

    if (tx.tx_position > botTxPosition1 && tx.tx_position < botTxPosition2) {
      potentialLossTx.push(tx);
    }
  }

  return potentialLossTx;
}

async function processSingleSandwich(
  botTransaction: ExtendedTransactionData[],
  candidate: ExtendedTransactionData[]
): Promise<void> {
  const frontrunTxId = botTransaction[0].tx_id!;
  const frontrunTransaction = await Transactions.findOne({ where: { tx_id: frontrunTxId } });

  if (!frontrunTransaction) {
    throw new Error(`Frontrun transaction with ID ${frontrunTxId} not found`);
  }

  const potentialLossTransactions = await findPotentialLossTransactions(botTransaction, candidate);
  let extractedFromCurve = false;
  let lossTransactions: any = [];
  let sandwichCenterTxId = null;

  for (const potentialLossTransaction of potentialLossTransactions) {
    let lossInfo = await calcTheLossOfCurveUserFromSandwich(potentialLossTransaction);
    if (!lossInfo) {
      await updateSandwichFlagForSingleTx(potentialLossTransaction.tx_id!, false);
      continue;
    }
    if (lossInfo.amount > 0) {
      const pricedTransaction = await priceTransaction(potentialLossTransaction);
      const lossInUsd = pricedTransaction ? (pricedTransaction * lossInfo.lossInPercentage) / 100 : null;
      lossTransactions.push({
        tx_id: potentialLossTransaction.tx_id,
        amount: lossInfo.amount,
        unit: lossInfo.unit,
        unitAddress: lossInfo.unitAddress,
        lossInPercentage: lossInfo.lossInPercentage,
        lossInUsd: lossInUsd,
      });
      extractedFromCurve = true;
      sandwichCenterTxId = potentialLossTransaction.tx_id;
    }
  }

  if (lossTransactions.length === 0) {
    lossTransactions = null;
  }

  // Save sandwich with pool_id
  await saveSandwich(
    frontrunTransaction.pool_id,
    botTransaction[0].tx_id!,
    botTransaction[1].tx_id!,
    extractedFromCurve,
    lossTransactions
  );
  await updateSandwichFlagForSingleTx(botTransaction[0].tx_id!, false);
  await updateSandwichFlagForSingleTx(botTransaction[1].tx_id!, false);
  await updateSandwichFlagForSingleTx(sandwichCenterTxId!, true);

  // If everything is up to date, we livestream new sandwiches to clients.
  if (eventFlags.canEmitSandwich) {
    const latestSandwich = await Sandwiches.findOne({
      order: [['id', 'DESC']],
      attributes: ['id'],
      raw: true,
    });

    const latestSandwichId = latestSandwich ? latestSandwich.id : null;
    eventEmitter.emit('New Sandwich for General-Sandwich-Livestream-Subscribers', latestSandwichId);
  }
}

export async function screenCandidate(candidate: ExtendedTransactionData[]): Promise<void> {
  let botTransactions = await getBotTransactions(candidate);
  if (botTransactions.length === 0) {
    for (let i = 0; i < candidate.length; i++) {
      await updateSandwichFlagForSingleTx(candidate[i].tx_id!, false);
    }
  } else {
    for (const botTransaction of botTransactions) {
      await processSingleSandwich(botTransaction, candidate);
    }
  }
}
