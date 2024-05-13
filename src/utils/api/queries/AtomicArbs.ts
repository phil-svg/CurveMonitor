import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { ArbBotLeaderBoardbyTxCount, TransactionDetailsForAtomicArbs } from '../../Interfaces.js';
import { getTimeframeTimestamp } from '../utils/Timeframes.js';
import { TotalResult } from '../../postgresTables/readFunctions/Sandwiches.js';
import { Transactions } from '../../../models/Transactions.js';
import { AtomicArbs } from '../../../models/AtomicArbs.js';
import { getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';

export async function getTotalNumberOfAtomicArbsForDuration(timeDuration: string): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const query = `
    SELECT COUNT(*) AS total
    FROM atomic_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.is_atomic_arb = true
  `;

  const result: TotalResult[] = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: false,
    replacements: {
      timeframeStartUnix,
    },
  });

  const totalCount = result[0].total;

  return totalCount;
}

export async function getNumberOfAtomicArbsForPoolAndDuration(
  poolAddress: string,
  timeDuration: string
): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
  const poolId = await getPoolIdByPoolAddress(poolAddress);

  const query = `
    SELECT COUNT(*) AS total
    FROM atomic_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.is_atomic_arb = true
    AND t.pool_id = :poolId
  `;

  const result: TotalResult[] = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: false,
    replacements: {
      timeframeStartUnix,
      poolId,
    },
  });

  const totalCount = result[0].total;

  return totalCount;
}

export async function getAtomicArbsForDuration(
  duration: string,
  page: number
): Promise<TransactionDetailsForAtomicArbs[]> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(duration);

  const atomicArbs = await AtomicArbs.findAll({
    include: [
      {
        model: Transactions,
        as: 'transaction',
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
        },
        required: true,
      },
    ],
    where: {
      is_atomic_arb: true,
    },
    limit: recordsPerPage,
    offset: offset,
    order: [['transaction', 'block_unixtime', 'DESC']],
  });

  const enrichedAtomicArbs: TransactionDetailsForAtomicArbs[] = atomicArbs.map((arb) => {
    const transaction = arb.transaction.toJSON();

    return {
      ...transaction,
      tx_id: transaction.tx_id ?? 0,
      pool_id: transaction.pool_id ?? 0,
      event_id: transaction.event_id ?? null,
      tx_hash: transaction.tx_hash ?? '',
      block_number: transaction.block_number ?? 0,
      block_unixtime: transaction.block_unixtime ?? 0,
      transaction_type: transaction.transaction_type ?? '',
      trader: transaction.trader ?? '',
      tx_position: transaction.tx_position ?? 0,
      raw_fees: transaction.raw_fees ?? null,
      fee_usd: transaction.fee_usd ?? null,
      value_usd: transaction.value_usd ?? null,
      revenue: arb.revenue !== null ? parseFloat(arb.revenue as unknown as string) : null,
      gasInUsd: arb.gas_in_usd !== null ? parseFloat(arb.gas_in_usd as unknown as string) : 0,
      gasInGwei: arb.gas_in_gwei !== null ? parseFloat(arb.gas_in_gwei as unknown as string) : null,
      netWin: arb.net_win !== null ? parseFloat(arb.net_win as unknown as string) : null,
      bribe: arb.bribe !== null ? parseFloat(arb.bribe as unknown as string) : null,
      totalCost: arb.total_cost !== null ? parseFloat(arb.total_cost as unknown as string) : null,
      blockBuilder: arb.block_builder ?? null,
      validatorPayOffUSD:
        arb.block_payout_to_validator !== null ? parseFloat(arb.block_payout_to_validator as unknown as string) : null,
    };
  });

  return enrichedAtomicArbs;
}

export async function getAtomicArbsForPoolAndDuration(
  poolAddress: string,
  duration: string,
  page: number
): Promise<TransactionDetailsForAtomicArbs[]> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(duration);
  const poolId = await getPoolIdByPoolAddress(poolAddress);

  const atomicArbs = await AtomicArbs.findAll({
    include: [
      {
        model: Transactions,
        as: 'transaction',
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
          pool_id: poolId,
        },
        required: true,
      },
    ],
    where: {
      is_atomic_arb: true,
    },
    limit: recordsPerPage,
    offset: offset,
    order: [['transaction', 'block_unixtime', 'DESC']],
  });

  const enrichedAtomicArbs: TransactionDetailsForAtomicArbs[] = atomicArbs.map((arb) => {
    const transaction = arb.transaction.toJSON();

    return {
      ...transaction,
      tx_id: transaction.tx_id ?? 0,
      pool_id: transaction.pool_id ?? 0,
      event_id: transaction.event_id ?? null,
      tx_hash: transaction.tx_hash ?? '',
      block_number: transaction.block_number ?? 0,
      block_unixtime: transaction.block_unixtime ?? 0,
      transaction_type: transaction.transaction_type ?? '',
      trader: transaction.trader ?? '',
      tx_position: transaction.tx_position ?? 0,
      raw_fees: transaction.raw_fees ?? null,
      fee_usd: transaction.fee_usd ?? null,
      value_usd: transaction.value_usd ?? null,
      revenue: arb.revenue !== null ? parseFloat(arb.revenue as unknown as string) : null,
      gasInUsd: arb.gas_in_usd !== null ? parseFloat(arb.gas_in_usd as unknown as string) : 0,
      gasInGwei: arb.gas_in_gwei !== null ? parseFloat(arb.gas_in_gwei as unknown as string) : null,
      netWin: arb.net_win !== null ? parseFloat(arb.net_win as unknown as string) : null,
      bribe: arb.bribe !== null ? parseFloat(arb.bribe as unknown as string) : null,
      totalCost: arb.total_cost !== null ? parseFloat(arb.total_cost as unknown as string) : null,
      blockBuilder: arb.block_builder ?? null,
      validatorPayOffUSD:
        arb.block_payout_to_validator !== null ? parseFloat(arb.block_payout_to_validator as unknown as string) : null,
    };
  });

  return enrichedAtomicArbs;
}

export async function getFullAtomicArbTable(
  duration: string,
  page: number
): Promise<{ data: TransactionDetailsForAtomicArbs[]; totalNumberOfAtomicArbs: number }> {
  const totalNumberOfAtomicArbs = await getTotalNumberOfAtomicArbsForDuration(duration);
  const atomicArbs: TransactionDetailsForAtomicArbs[] = await getAtomicArbsForDuration(duration, page);

  return { data: atomicArbs, totalNumberOfAtomicArbs };
}

export async function getPoolSpecificAtomicArbTable(
  poolAddress: string,
  duration: string,
  page: number
): Promise<{ data: TransactionDetailsForAtomicArbs[]; totalNumberOfAtomicArbs: number }> {
  const totalNumberOfAtomicArbs = await getNumberOfAtomicArbsForPoolAndDuration(poolAddress, duration);
  const atomicArbs: TransactionDetailsForAtomicArbs[] = await getAtomicArbsForPoolAndDuration(
    poolAddress,
    duration,
    page
  );

  return { data: atomicArbs, totalNumberOfAtomicArbs };
}

export async function getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(
  poolAddress: string,
  duration: string
): Promise<ArbBotLeaderBoardbyTxCount[]> {
  const timeframeStartUnix = getTimeframeTimestamp(duration);
  const poolId = await getPoolIdByPoolAddress(poolAddress);

  if (!poolId) {
    throw new Error(`Pool ID not found for address: ${poolAddress}`);
  }

  const query = `
    SELECT 
      td.to AS contractAddress, 
      COUNT(*) AS txCount
    FROM 
      atomic_arbs aa
    JOIN 
      transactions t ON aa.tx_id = t.tx_id
    JOIN 
      transaction_details td ON t.tx_id = td.tx_id
    WHERE 
      t.block_unixtime >= :timeframeStartUnix
      AND t.pool_id = :poolId
      AND aa.is_atomic_arb = true
    GROUP BY 
      td.to
    ORDER BY 
      txCount DESC
  `;

  const result: ArbBotLeaderBoardbyTxCount[] = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: true,
    replacements: {
      timeframeStartUnix,
      poolId,
    },
  });

  return result;
}
