import { Op } from 'sequelize';
import { Transactions } from '../../../models/Transactions.js';
import { convertDateToUnixTime } from '../../helperFunctions/QualityOfLifeStuff.js';
import { getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';
import { findTransactionCoinsByTxIds } from '../../postgresTables/readFunctions/TransactionCoins.js';
import { CoinMovement } from '../../Interfaces.js';
import { getTransactionVolume } from '../utils/Volume.js';
import { saveEnhancedSwapDetailsToExcel, savePriceImpactThingsToExcel } from '../utils/Excel.js';
import { calculateTVLChangesOverTime } from './Tvl.js';
import { getTokenPriceWithTimestampFromDb } from '../../postgresTables/readFunctions/PriceMap.js';
import { getUnixTimestampByTxId } from '../../postgresTables/readFunctions/Transactions.js';
import { getCoinIdByAddress } from '../../postgresTables/readFunctions/Coins.js';

export interface SwapDetails {
  bought: string;
  sold: string;
  priceImpactInPercentage: number;
  swapVolumeUSD: number;
}

export async function fetchSortedTransactionIdsByDateAndPool(
  poolAddress: string,
  startDate: string,
  endDate: string
): Promise<number[]> {
  const startUnixtime = convertDateToUnixTime(startDate);
  const endUnixtime = convertDateToUnixTime(endDate);

  // Convert pool address to pool ID
  const poolId = await getPoolIdByPoolAddress(poolAddress);
  if (poolId === null) {
    throw new Error('Pool not found for the given address');
  }

  // Fetch transactions matching the poolId within the specified time range
  const transactions = await Transactions.findAll({
    where: {
      pool_id: poolId,
      block_unixtime: {
        [Op.gte]: startUnixtime,
        [Op.lte]: endUnixtime,
      },
    },
    order: [
      ['block_unixtime', 'ASC'], // Sort by time first
      ['tx_position', 'ASC'], // Then by transaction position within the block
    ],
    attributes: ['tx_id'], // Only fetch the transaction IDs
    raw: true,
  });

  // Map the results to an array of transaction IDs
  const transactionIds = transactions.map((tx) => tx.tx_id);

  return transactionIds;
}

async function findConsecutiveTransactionPairsWithMatchingSwaps(sortedTxIds: number[]): Promise<number[][]> {
  const consecutiveTxPairs: number[][] = [];
  const coinMovements = await findTransactionCoinsByTxIds(sortedTxIds);

  // Group coin movements by tx_id for easier comparison
  const movementsByTxId: { [txId: number]: CoinMovement[] } = {};
  coinMovements.forEach((movement) => {
    movementsByTxId[movement.tx_id] = movementsByTxId[movement.tx_id] || [];
    movementsByTxId[movement.tx_id].push(movement);
  });

  // Iterate through sortedTxIds to compare consecutive transactions
  for (let i = 0; i < sortedTxIds.length - 1; i++) {
    const currentTxId = sortedTxIds[i];
    const nextTxId = sortedTxIds[i + 1];

    if (movementsByTxId[currentTxId] && movementsByTxId[nextTxId]) {
      const currentMovements = movementsByTxId[currentTxId];
      const nextMovements = movementsByTxId[nextTxId];

      // Extract coin_ids for "in" and "out" movements for comparison
      const currentInCoins = currentMovements
        .filter((movement) => movement.direction === 'in')
        .map((movement) => movement.coin_id);
      const currentOutCoins = currentMovements
        .filter((movement) => movement.direction === 'out')
        .map((movement) => movement.coin_id);
      const nextInCoins = nextMovements
        .filter((movement) => movement.direction === 'in')
        .map((movement) => movement.coin_id);
      const nextOutCoins = nextMovements
        .filter((movement) => movement.direction === 'out')
        .map((movement) => movement.coin_id);

      // Check for matching "in" coins and "out" coins between the two sets
      const matchingInCoins =
        currentInCoins.every((coinId) => nextInCoins.includes(coinId)) && currentInCoins.length === nextInCoins.length;
      const matchingOutCoins =
        currentOutCoins.every((coinId) => nextOutCoins.includes(coinId)) &&
        currentOutCoins.length === nextOutCoins.length;

      if (matchingInCoins && matchingOutCoins) {
        // If both "in" and "out" coins match between the two transactions, add this pair to the array
        consecutiveTxPairs.push([currentTxId, nextTxId]);
      }
    }
  }

  return consecutiveTxPairs;
}

interface SwapDetail {
  bought: string;
  sold: string;
  priceImpactInPercentage: number;
  swapVolumeUSD: number;
  txId: number;
}

async function getSwapDetailsAndImpactForTxPairs(matchingTxIds: number[][]): Promise<SwapDetail[]> {
  const result: SwapDetail[] = [];

  for (const pair of matchingTxIds) {
    const [txId1, txId2] = pair;

    // Your existing logic here for fetching coin movements and calculating swap details
    const movements1 = await findTransactionCoinsByTxIds([txId1]);
    const movements2 = await findTransactionCoinsByTxIds([txId2]);

    const inMovement1 = movements1.find((movement) => movement.direction === 'in');
    const outMovement1 = movements1.find((movement) => movement.direction === 'out');
    const inMovement2 = movements2.find((movement) => movement.direction === 'in');
    const outMovement2 = movements2.find((movement) => movement.direction === 'out');

    if (inMovement1 && outMovement1 && inMovement2 && outMovement2) {
      const priceBefore = Number(outMovement1.amount) / Number(inMovement1.amount);
      const priceAfter = Number(outMovement2.amount) / Number(inMovement2.amount);
      const priceImpactPercentage = (priceAfter / priceBefore - 1) * 100;

      const volumeUSD = await getTransactionVolume(txId2);

      const swapDetails: SwapDetail = {
        bought: inMovement2.coin.symbol,
        sold: outMovement2.coin.symbol,
        priceImpactInPercentage: Math.abs(priceImpactPercentage),
        swapVolumeUSD: Number(volumeUSD.toFixed(2)),
        txId: txId2,
      };

      result.push(swapDetails);
    }
  }

  return result;
}

function groupSwapsByTokenPairs(swaps: SwapDetails[]): { [pair: string]: SwapDetails[] } {
  const groupedSwaps: { [pair: string]: SwapDetails[] } = {};

  for (const swap of swaps) {
    const pairTokens = [swap.bought, swap.sold].sort(); // Sort the tokens alphabetically
    const pairKey = pairTokens.join('-'); // Create the pair key

    if (!groupedSwaps[pairKey]) {
      groupedSwaps[pairKey] = [];
    }

    groupedSwaps[pairKey].push(swap);
  }

  return groupedSwaps;
}

function groupEnhancedSwapsByTokenPairs(swaps: EnhancedSwapDetail[]): { [pair: string]: EnhancedSwapDetail[] } {
  const groupedSwaps: { [pair: string]: EnhancedSwapDetail[] } = {};

  swaps.forEach((swap) => {
    const pairTokens = [swap.bought, swap.sold].sort(); // Sort the tokens alphabetically
    const pairKey = pairTokens.join('-');
    if (!groupedSwaps[pairKey]) {
      groupedSwaps[pairKey] = [];
    }
    groupedSwaps[pairKey].push(swap);
  });

  return groupedSwaps;
}

function removeBoughtSoldProperties(groupedSwaps: { [pair: string]: SwapDetails[] }): {
  [pair: string]: { priceImpactInPercentage: number; swapVolumeUSD: number }[];
} {
  const modifiedSwaps: { [pair: string]: { priceImpactInPercentage: number; swapVolumeUSD: number }[] } = {};

  for (const pairKey in groupedSwaps) {
    if (groupedSwaps.hasOwnProperty(pairKey)) {
      const swaps = groupedSwaps[pairKey];
      modifiedSwaps[pairKey] = swaps.map(({ priceImpactInPercentage, swapVolumeUSD }) => ({
        priceImpactInPercentage,
        swapVolumeUSD,
      }));
    }
  }

  return modifiedSwaps;
}

function removeBoughtSoldPropertiesFromEnhanced(groupedSwaps: { [pair: string]: EnhancedSwapDetail[] }): {
  [pair: string]: { priceImpactInPercentage: number; swapVolumeUSD: number; tvlPercentage: number }[];
} {
  const modifiedSwaps: {
    [pair: string]: { priceImpactInPercentage: number; swapVolumeUSD: number; tvlPercentage: number }[];
  } = {};

  Object.entries(groupedSwaps).forEach(([pairKey, swaps]) => {
    modifiedSwaps[pairKey] = swaps.map(({ priceImpactInPercentage, swapVolumeUSD, tvlPercentage }) => ({
      priceImpactInPercentage,
      swapVolumeUSD,
      tvlPercentage,
    }));
  });

  return modifiedSwaps;
}

interface EnhancedSwapDetail extends SwapDetail {
  tvlPercentage: number;
  totalTvlUsdAtSwap: number;
}

async function calculateSwapImpactIncludingTVL(
  poolAddress: string,
  startDate: string,
  endDate: string
): Promise<EnhancedSwapDetail[]> {
  const sortedTxIds = await fetchSortedTransactionIdsByDateAndPool(poolAddress, startDate, endDate);
  const matchingTxIds = await findConsecutiveTransactionPairsWithMatchingSwaps(sortedTxIds);
  const priceImpactTxs = await getSwapDetailsAndImpactForTxPairs(matchingTxIds);
  const tvlChanges = await calculateTVLChangesOverTime(poolAddress, startDate, endDate);

  const enhancedSwapDetails: EnhancedSwapDetail[] = await Promise.all(
    priceImpactTxs.map(async (swapDetail) => {
      // Find the TVL at the time of the swap
      const txIndex = sortedTxIds.indexOf(swapDetail.txId);
      const unixtime = txIndex >= 0 ? await getUnixTimestampByTxId(swapDetail.txId) : null;
      let totalTvlUsdAtSwap = 0;

      if (unixtime !== null) {
        for (const tvlChange of tvlChanges) {
          const coinId = await getCoinIdByAddress(tvlChange.address);
          const price = await getTokenPriceWithTimestampFromDb(coinId!, unixtime);
          const balanceAtTx =
            tvlChange.changes.find((change) => change.txId === swapDetail.txId)?.newBalance || tvlChange.startBalance;
          totalTvlUsdAtSwap += price ? balanceAtTx * price : 0;
        }
      }

      const tvlPercentage = totalTvlUsdAtSwap ? (swapDetail.swapVolumeUSD / totalTvlUsdAtSwap) * 100 : 0;

      return {
        ...swapDetail,
        tvlPercentage,
        totalTvlUsdAtSwap,
      };
    })
  );

  return enhancedSwapDetails;
}

export async function priceImpactThings(): Promise<void> {
  const tricrypto2 = '0xd51a44d3fae010294c616388b506acda1bfaae46';
  const tricryptoUSDT = '0xf5f5b97624542d72a9e06f04804bf81baa15e2b4';
  const tricryptoUSDC = '0x7f86bf177dd4f3494b841a37e810a34dd56c829b';

  const poolAddress = tricryptoUSDC;
  const startDate = '2024-01-15';
  const endDate = '2024-01-22';

  const calculatedSwapImpactIncludingTVL = await calculateSwapImpactIncludingTVL(poolAddress, startDate, endDate);
  // console.log("calculatedSwapImpactIncludingTVL", calculatedSwapImpactIncludingTVL);
  const groupedSwaps = groupEnhancedSwapsByTokenPairs(calculatedSwapImpactIncludingTVL);
  const sortedGroupedSwaps = removeBoughtSoldPropertiesFromEnhanced(groupedSwaps);
  saveEnhancedSwapDetailsToExcel(sortedGroupedSwaps, 'tricryptoUSDC.xlsx');
  console.log('done');
}
