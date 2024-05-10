import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { TotalResult } from '../../postgresTables/readFunctions/Sandwiches.js';
import { getTimeframeTimestamp } from '../utils/Timeframes.js';
import { enrichTransactionDetail } from '../../postgresTables/readFunctions/TxDetailEnrichment.js';
import { getEnrichedCexDexDetails } from '../../postgresTables/mevDetection/cexdex/utils/cexdexDetection.js';
import { EnrichedCexDexDetails } from '../../Interfaces.js';
import { CexDexArbs } from '../../../models/CexDexArbs.js';
import { Transactions } from '../../../models/Transactions.js';
import { getPoolIdByPoolAddress } from '../../postgresTables/readFunctions/Pools.js';

export async function getTotalNumberOfCexDexArbsForDuration(timeDuration: string): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const query = `
    SELECT COUNT(*) AS total
    FROM cex_dex_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
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

export async function getNumberOfCexDexArbsForPoolAndDuration(
  poolAddress: string,
  timeDuration: string
): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
  const poolId = await getPoolIdByPoolAddress(poolAddress);

  const query = `
    SELECT COUNT(*) AS total
    FROM cex_dex_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.pool_id = :poolId
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

export async function getCexDexArbDetailsFromTxId(txId: number): Promise<EnrichedCexDexDetails | null> {
  const enrichedTransaction = await enrichTransactionDetail(txId);
  if (!enrichedTransaction) return null;
  const enrichedCexDexDetails = await getEnrichedCexDexDetails(enrichedTransaction);
  return enrichedCexDexDetails;
}

export async function getCexDexArbsForDuration(duration: string, page: number): Promise<EnrichedCexDexDetails[]> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(duration);

  const cexDexArbs = await CexDexArbs.findAll({
    attributes: ['tx_id'],
    include: [
      {
        model: Transactions,
        as: 'transaction',
        attributes: [],
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
        },
        required: true,
      },
    ],
    limit: recordsPerPage,
    offset: offset,
    order: [['transaction', 'block_unixtime', 'DESC']],
  });

  const txIds = cexDexArbs.map((arb) => arb.tx_id);

  const enrichedCexDexArbs = await Promise.all(txIds.map(async (txId) => await getCexDexArbDetailsFromTxId(txId)));

  return enrichedCexDexArbs.filter((arb) => arb !== null) as EnrichedCexDexDetails[];
}

export async function getCexDexArbsForPoolAndDuration(
  poolAddress: string,
  duration: string,
  page: number
): Promise<EnrichedCexDexDetails[]> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(duration);
  const poolId = await getPoolIdByPoolAddress(poolAddress);

  const cexDexArbs = await CexDexArbs.findAll({
    attributes: ['tx_id'],
    include: [
      {
        model: Transactions,
        as: 'transaction',
        attributes: [],
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
          pool_id: poolId,
        },
        required: true,
      },
    ],
    limit: recordsPerPage,
    offset: offset,
    order: [['transaction', 'block_unixtime', 'DESC']],
  });

  const txIds = cexDexArbs.map((arb) => arb.tx_id);

  const enrichedCexDexArbs = await Promise.all(txIds.map(async (txId) => await getCexDexArbDetailsFromTxId(txId)));

  return enrichedCexDexArbs.filter((arb) => arb !== null) as EnrichedCexDexDetails[];
}

export async function getFullCexDexArbTable(
  duration: string,
  page: number
): Promise<{ data: EnrichedCexDexDetails[]; totalNumberOfCexDexArbs: number }> {
  const totalNumberOfCexDexArbs = await getTotalNumberOfCexDexArbsForDuration(duration);
  const atomicArbs: EnrichedCexDexDetails[] = await getCexDexArbsForDuration(duration, page);

  return { data: atomicArbs, totalNumberOfCexDexArbs };
}

export async function getPoolSpecificCexDexArbTable(
  poolAddress: string,
  duration: string,
  page: number
): Promise<{ data: EnrichedCexDexDetails[]; totalNumberOfCexDexArbs: number }> {
  const totalNumberOfCexDexArbs = await getNumberOfCexDexArbsForPoolAndDuration(poolAddress, duration);
  const cexDexArbs: EnrichedCexDexDetails[] = await getCexDexArbsForPoolAndDuration(poolAddress, duration, page);

  return { data: cexDexArbs, totalNumberOfCexDexArbs };
}
