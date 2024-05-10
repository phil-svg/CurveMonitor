import { Coins } from '../../../models/Coins.js';
import { Pool } from '../../../models/Pools.js';
import { convertDateToUnixTime } from '../../helperFunctions/QualityOfLifeStuff.js';
import { getAbiByForPools } from '../../postgresTables/Abi.js';
import { getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';
import { findTransactionCoinsByTxIds } from '../../postgresTables/readFunctions/TransactionCoins.js';
import { getBlockNumberFromTxId } from '../../postgresTables/readFunctions/Transactions.js';
import { WEB3_HTTP_PROVIDER, web3Call } from '../../web3Calls/generic.js';
import { fetchSortedTransactionIdsByDateAndPool } from './PriceImpact.js';

export interface TVLChange {
  symbol: string;
  address: string;
  startBalance: number;
  changes: { txId: number; newBalance: number }[];
  finalPredictedBalance: number;
  finalActualBalance?: number;
}

export async function getPoolTokenBalancesAtBlock(
  poolAddress: string,
  blockNumber: number
): Promise<{ symbol: string; address: string; balance: number }[] | null> {
  const poolId = await getPoolIdByPoolAddress(poolAddress);
  if (!poolId) {
    console.log('Failed to Fetch Pool ID for', poolAddress);
    return null;
  }

  const pool = await Pool.findByPk(poolId);
  if (!pool || !pool.coins || pool.coins.length === 0) {
    console.log('Pool not found or no coins associated with pool', poolAddress);
    return null;
  }

  const ABI = await getAbiByForPools({ id: poolId });
  if (!ABI) {
    console.log('Failed to Fetch ABI for', poolAddress);
    return null;
  }

  const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI, poolAddress);
  const balancesWithCoinInfo: { symbol: string; address: string; balance: number }[] = [];

  for (let i = 0; i < pool.coins.length; i++) {
    const coinAddress = pool.coins[i];
    const balance = await web3Call(CONTRACT, 'balances', [i], blockNumber);

    // Fetch additional coin information from the Coins table
    const coinInfo = await Coins.findOne({ where: { address: coinAddress } });

    if (coinInfo) {
      balancesWithCoinInfo.push({
        symbol: coinInfo.symbol!,
        address: coinAddress,
        balance: Number(balance / 10 ** coinInfo.decimals!),
      });
    }
  }

  return balancesWithCoinInfo;
}

export function getBlockNumberAtTime(unixtime: number): number {
  const calibrationBlock = 19168338;
  const calibrationBlockUnixtime = 1707212027;
  const secondsPerBlock = 12;

  // Calculate the time difference in seconds
  const timeDifference = unixtime - calibrationBlockUnixtime;

  // Calculate the number of blocks since the calibration block
  const blocksSinceCalibration = timeDifference / secondsPerBlock;

  // Estimate the block number at the given unixtime
  const estimatedBlockNumber = calibrationBlock + Math.round(blocksSinceCalibration);

  return estimatedBlockNumber;
}

export async function calculateTVLChangesOverTime(
  poolAddress: string,
  startDate: string,
  endDate: string
): Promise<TVLChange[]> {
  // Fetch sorted transaction IDs
  const sortedTxIds = await fetchSortedTransactionIdsByDateAndPool(poolAddress, startDate, endDate);

  const startUnixtime = convertDateToUnixTime(startDate);

  const startTxId = sortedTxIds[0];
  const startBlockNumber = await getBlockNumberFromTxId(startTxId);

  // Initial balances at the start
  const initialBalances = await getPoolTokenBalancesAtBlock(poolAddress, startBlockNumber!);
  if (!initialBalances) {
    console.error('Failed to fetch initial token balances.');
    return [];
  }

  // Prepare data structure for tracking TVL changes
  const tvlChanges: TVLChange[] = initialBalances.map((balance) => ({
    symbol: balance.symbol,
    address: balance.address,
    startBalance: balance.balance,
    changes: [],
    finalPredictedBalance: balance.balance,
  }));

  // Iterate over transactions to adjust balances
  for (const txId of sortedTxIds) {
    const coinMovements = await findTransactionCoinsByTxIds([txId]);

    coinMovements.forEach((movement) => {
      const tvlEntry = tvlChanges.find((entry) => entry.address === movement.coin.address);
      if (tvlEntry) {
        const amount = parseFloat(movement.amount);
        if (movement.direction === 'out') {
          tvlEntry.finalPredictedBalance += amount;
        }
        if (movement.direction === 'in') {
          tvlEntry.finalPredictedBalance -= amount;
        }
        tvlEntry.changes.push({ txId, newBalance: tvlEntry.finalPredictedBalance });
      }
    });
  }

  const endTxId = sortedTxIds[sortedTxIds.length - 1];
  const endBlockNumber = await getBlockNumberFromTxId(endTxId);

  // Optionally, compare final predicted balance with actual balance for verification
  const finalActualBalances = await getPoolTokenBalancesAtBlock(poolAddress, endBlockNumber! + 1);
  if (finalActualBalances) {
    finalActualBalances.forEach((actualBalance) => {
      const tvlEntry = tvlChanges.find((entry) => entry.address === actualBalance.address);
      if (tvlEntry) {
        tvlEntry.finalActualBalance = actualBalance.balance;
      }
    });
  }

  return tvlChanges;
}

export async function tvlThings(): Promise<void> {
  const tricrypto2 = '0xd51a44d3fae010294c616388b506acda1bfaae46';
  const tricryptoUSDT = '0xf5f5b97624542d72a9e06f04804bf81baa15e2b4';
  const tricryptoUSDC = '0x7f86bf177dd4f3494b841a37e810a34dd56c829b';

  // const blockNumber = 19168868;
  // const poolTokenBalancesAtBlock = await getPoolTokenBalancesAtBlock(tricrypto2, blockNumber);
  // console.log("poolTokenBalancesAtBlock", poolTokenBalancesAtBlock);

  const poolAddress = tricryptoUSDT;
  const startDate = '2024-01-15';
  const endDate = '2024-01-22';

  const calculatedTVLChangesOverTime = await calculateTVLChangesOverTime(poolAddress, startDate, endDate);
  console.log('calculatedTVLChangesOverTime', calculatedTVLChangesOverTime);
}
