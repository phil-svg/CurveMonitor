import { Op, QueryTypes, Sequelize } from 'sequelize';
import { LossTransaction, Sandwiches } from '../../../models/Sandwiches.js';
import { Transactions } from '../../../models/Transactions.js';
import { getPoolIdByPoolAddress } from './Pools.js';
import { getTimeframeTimestamp } from '../../api/utils/Timeframes.js';
import { SandwichDetail } from './SandwichDetail.js';
import { enrichSandwiches } from './SandwichDetailEnrichments.js';
import { sequelize } from '../../../config/Database.js';

export async function readSandwichesInBatches(
  batchSize: number = 100
): Promise<{ id: number; loss_transactions: any }[][]> {
  let offset = 0;
  const batches: { id: number; loss_transactions: any }[][] = [];

  while (true) {
    const sandwiches = await Sandwiches.findAll({
      where: {
        extracted_from_curve: true,
        source_of_loss_contract_address: null,
      },
      limit: batchSize,
      offset: offset,
    });

    if (sandwiches.length === 0) {
      break;
    }

    const transformedSandwiches = sandwiches.map((sandwich) => ({
      id: sandwich.id,
      loss_transactions: sandwich.loss_transactions,
    }));

    batches.push(transformedSandwiches);
    offset += batchSize;
  }

  return batches;
}

export async function readSandwichesInBatchesForBlock(
  blockNumber: number,
  batchSize: number = 100
): Promise<{ id: number; loss_transactions: any }[][]> {
  let offset = 0;
  const batches: { id: number; loss_transactions: any }[][] = [];

  while (true) {
    const sandwiches = await Sandwiches.findAll({
      where: {
        extracted_from_curve: true,
        source_of_loss_contract_address: null,
      },
      include: [
        {
          model: Transactions,
          as: 'frontrunTransaction',
          where: { block_number: blockNumber },
          required: true,
        },
        {
          model: Transactions,
          as: 'backrunTransaction',
          where: { block_number: blockNumber },
          required: true,
        },
      ],
      limit: batchSize,
      offset: offset,
    });

    if (sandwiches.length === 0) {
      break;
    }

    const transformedSandwiches = sandwiches.map((sandwich) => ({
      id: sandwich.id,
      loss_transactions: sandwich.loss_transactions,
    }));

    batches.push(transformedSandwiches);
    offset += batchSize;
  }

  return batches;
}

export async function findUniqueSourceOfLossAddresses(): Promise<string[]> {
  const sandwiches = await Sandwiches.findAll({
    attributes: [
      [Sequelize.fn('DISTINCT', Sequelize.col('source_of_loss_contract_address')), 'source_of_loss_contract_address'],
    ],
  });
  return sandwiches.map((sandwich) => sandwich.getDataValue('source_of_loss_contract_address'));
}

export async function getAllRawTableEntriesForPoolByPoolAddress(poolAddress: string): Promise<Sandwiches[]> {
  let poolId = await getPoolIdByPoolAddress(poolAddress);
  return await getAllRawSandwichTableEntriesForPoolByPoolId(poolId!);
}

export async function getAllRawSandwichTableEntriesForPoolByPoolId(poolId: number): Promise<Sandwiches[]> {
  const poolRelatedSandwiches = await Sandwiches.findAll({ where: { pool_id: poolId } });
  return poolRelatedSandwiches;
}

export async function getExtractedSandwichesByPoolId(poolId: number): Promise<Sandwiches[]> {
  const extractedSandwiches = await Sandwiches.findAll({
    where: {
      pool_id: poolId,
      extracted_from_curve: true,
    },
  });
  return extractedSandwiches;
}

export const isExtractedFromCurve = async (id: number): Promise<boolean> => {
  const sandwich = await Sandwiches.findByPk(id);
  return sandwich ? sandwich.extracted_from_curve : false;
};

export async function getAllIdsForFullSandwichTable(timeDuration: string): Promise<number[]> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const sandwiches = await Sandwiches.findAll({
    include: [
      {
        model: Transactions,
        as: 'frontrunTransaction',
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
        },
        required: true,
      },
    ],
    where: {
      extracted_from_curve: true,
    },
    order: [[{ model: Transactions, as: 'frontrunTransaction' }, 'block_unixtime', 'DESC']],
  });

  const ids = sandwiches.map((sandwich) => sandwich.id);

  return ids;
}

export interface TotalResult {
  total: number;
}

async function getTotalNumberOfSandwichesForTimeDuration(timeDuration: string): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const query = `
    SELECT COUNT(*) AS total
    FROM sandwiches s
    JOIN transactions t ON s.frontrun = t.tx_id -- Ensure correct join columns
    WHERE s.extracted_from_curve = true
      AND t.block_unixtime >= :timeframeStartUnix
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

async function getSandwichIdsForTimeframe(timeDuration: string, page: number): Promise<number[]> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const sandwiches = await Sandwiches.findAll({
    include: [
      {
        model: Transactions,
        as: 'frontrunTransaction',
        where: {
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
        },
        required: true,
      },
    ],
    where: {
      extracted_from_curve: true,
    },
    limit: recordsPerPage,
    offset: offset,
    order: [[{ model: Transactions, as: 'frontrunTransaction' }, 'block_unixtime', 'DESC']],
  });

  const ids = sandwiches.map((sandwich) => sandwich.id);
  return ids;
}

export async function getIdsForFullSandwichTable(
  timeDuration: string,
  page: number
): Promise<{ ids: number[]; totalSandwiches: number }> {
  const totalSandwiches = await getTotalNumberOfSandwichesForTimeDuration(timeDuration);
  const sandwichIds = await getSandwichIdsForTimeframe(timeDuration, page);

  return { ids: sandwichIds, totalSandwiches };
}

async function getTotalNumberOfSandwichesForPoolAndTimeDuration(poolId: number, timeDuration: string): Promise<number> {
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const query = `
    SELECT COUNT(*) AS total
    FROM sandwiches s
    JOIN transactions t ON s.frontrun = t.tx_id -- Ensure correct join columns
    WHERE s.extracted_from_curve = true
      AND t.pool_id = :poolId
      AND t.block_unixtime >= :timeframeStartUnix
  `;

  const result: TotalResult[] = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    raw: false,
    replacements: {
      poolId,
      timeframeStartUnix,
    },
  });

  const totalSandwiches = result[0].total;

  return totalSandwiches;
}

export async function getIdsForFullSandwichTableForPool(
  timeDuration: string,
  poolId: number,
  page: number = 1
): Promise<{ ids: number[]; totalSandwiches: number }> {
  const recordsPerPage = 10;
  const offset = (page - 1) * recordsPerPage;
  const timeframeStartUnix = getTimeframeTimestamp(timeDuration);

  const totalSandwiches = await getTotalNumberOfSandwichesForPoolAndTimeDuration(poolId, timeDuration);

  const sandwiches = await Sandwiches.findAll({
    include: [
      {
        model: Transactions,
        as: 'frontrunTransaction',
        where: {
          pool_id: poolId,
          block_unixtime: {
            [Op.gte]: timeframeStartUnix,
          },
        },
        required: true,
      },
    ],
    where: {
      extracted_from_curve: true,
    },
    limit: recordsPerPage,
    offset: offset,
    order: [[{ model: Transactions, as: 'frontrunTransaction' }, 'block_unixtime', 'DESC']],
  });

  const ids = sandwiches.map((sandwich) => sandwich.id);

  return { ids, totalSandwiches };
}

export async function getIdsOfSandwichesForPoolAndTimeIncludingVictimsOutsideCurve(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<number[]> {
  const sandwiches = await Sandwiches.findAll({
    include: [
      {
        model: Transactions,
        as: 'frontrunTransaction',
        where: {
          pool_id: poolId,
          block_unixtime: {
            [Op.gte]: startUnixtime,
            [Op.lt]: endUnixtime,
          },
        },
        required: true,
      },
    ],
    order: [[{ model: Transactions, as: 'frontrunTransaction' }, 'block_unixtime', 'DESC']],
  });

  const ids = sandwiches.map((sandwich) => sandwich.id);

  return ids;
}

export async function getSandwichContentForPoolAndTime(
  poolId: number,
  startUnixtime: number,
  endUnixtime: number
): Promise<SandwichDetail[]> {
  const ids = await getIdsOfSandwichesForPoolAndTimeIncludingVictimsOutsideCurve(poolId, startUnixtime, endUnixtime);
  const enrichedSandwiches = await enrichSandwiches(ids);
  return enrichedSandwiches;
}

export interface TransactionLossDetail {
  unit: string;
  tx_id: number;
  amount: number;
  lossInUsd: number;
  unitAddress: string;
  lossInPercentage: number;
}

export async function getLossInUsdForSandwich(sandwichId: number): Promise<number | null> {
  try {
    const sandwich = await Sandwiches.findByPk(sandwichId);
    if (
      sandwich &&
      sandwich.loss_transactions &&
      Array.isArray(sandwich.loss_transactions) &&
      sandwich.loss_transactions.length > 0
    ) {
      const lossTransactionDetail: TransactionLossDetail = sandwich.loss_transactions[0];
      return lossTransactionDetail.lossInUsd;
    } else {
      console.log(`No sandwich or loss transactions found with id: ${sandwichId}`);
      return null;
    }
  } catch (err) {
    console.error(`Failed to get loss in USD for sandwich with id: ${sandwichId}, error: ${err}`);
    return null;
  }
}

export async function fetchSandwichIdsByBlockNumber(blockNumber: number): Promise<number[]> {
  const sandwiches = await Sandwiches.findAll({
    attributes: ['id'],
    where: {
      [Op.or]: [
        { '$frontrunTransaction.block_number$': blockNumber },
        { '$backrunTransaction.block_number$': blockNumber },
      ],
    },
    include: [
      {
        model: Transactions,
        as: 'frontrunTransaction',
        attributes: [],
      },
      {
        model: Transactions,
        as: 'backrunTransaction',
        attributes: [],
      },
    ],
    raw: true,
  });

  return sandwiches.map((sandwich) => sandwich.id);
}

export async function isActuallyBackrun(txId: number): Promise<true | null> {
  const sandwich = await Sandwiches.findOne({
    where: {
      backrun: txId,
    },
  });

  if (sandwich) {
    return true;
  }

  return null;
}

export async function getSandwichLossInfoArrForAll(): Promise<LossTransaction[]> {
  const sandwichesWithLoss = await Sandwiches.findAll({
    where: {
      loss_transactions: {
        [Op.not]: null,
      },
    },
  });

  const lossTransactions: LossTransaction[] = sandwichesWithLoss.flatMap((sandwich) => {
    if (sandwich.loss_transactions) {
      return sandwich.loss_transactions.map((loss) => ({
        tx_id: loss.tx_id,
        amount: loss.amount,
        unit: loss.unit,
        unitAddress: loss.unitAddress,
        lossInPercentage: loss.lossInPercentage,
        lossInUsd: loss.lossInUsd,
      }));
    } else {
      return [];
    }
  });

  return lossTransactions;
}
