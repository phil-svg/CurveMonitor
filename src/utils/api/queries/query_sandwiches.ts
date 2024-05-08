import { QueryTypes, Sequelize } from 'sequelize';
import { Sandwiches } from '../../../models/Sandwiches.js';
import { getLabelNameFromAddress } from '../../postgresTables/readFunctions/Labels.js';
import { AddressesCalledCounts } from '../../../models/AddressesCalledCount.js';
import {
  getIdsForFullSandwichTable,
  getIdsForFullSandwichTableForPool,
} from '../../postgresTables/readFunctions/Sandwiches.js';
import { SandwichDetail, enrichSandwiches } from '../../postgresTables/readFunctions/SandwichDetailEnrichments.js';
import { getIdByAddressCaseInsensitive } from '../../postgresTables/readFunctions/Pools.js';
import { sequelize } from '../../../config/Database.js';

export async function getTotalAmountOfSandwichesInLocalDB(): Promise<number> {
  const count = await Sandwiches.count();
  return count;
}

export async function getTotalExtractedFromCurve(): Promise<number> {
  const count = await Sandwiches.count({
    where: {
      extracted_from_curve: true,
    },
  });
  return count;
}

interface LabelOccurrence {
  address: string;
  label: string;
  occurrences: number;
}

export async function getLabelsRankingDescendingAbsOccurrences(): Promise<LabelOccurrence[] | null> {
  try {
    const query = `
      SELECT 
        s.source_of_loss_contract_address AS address, 
        COALESCE(l.label, s.source_of_loss_contract_address) AS label, 
        COUNT(s.source_of_loss_contract_address) AS occurrences
      FROM 
        sandwiches s
      LEFT JOIN 
        labels l ON lower(s.source_of_loss_contract_address) = lower(l.address)
      GROUP BY 
        s.source_of_loss_contract_address, l.label
      ORDER BY 
        occurrences DESC;
    `;

    const labelsOccurrences: LabelOccurrence[] = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      raw: true,
    });

    // Convert occurrences to number
    const formattedOccurrences = labelsOccurrences.map((item) => ({
      ...item,
      occurrences: Number(item.occurrences),
    }));

    return formattedOccurrences;
  } catch (error) {
    console.error(`Error in getLabelsRankingDescendingAbsOccurrences: ${error}`);
    return null;
  }
}

interface LabelOccurrence {
  address: string;
  label: string;
  occurrences: number;
  numOfAllTx: number;
}

export async function getSandwichLabelOccurrences(): Promise<LabelOccurrence[] | null> {
  try {
    const query = `
      SELECT 
        s.source_of_loss_contract_address AS address, 
        COALESCE(l.label, s.source_of_loss_contract_address) AS label, 
        COUNT(s.source_of_loss_contract_address) AS occurrences,
        COALESCE(ac.count, 0) AS "numOfAllTx"
      FROM 
        sandwiches s
      LEFT JOIN 
        labels l ON lower(s.source_of_loss_contract_address) = lower(l.address)
      LEFT JOIN 
        address_counts ac ON lower(s.source_of_loss_contract_address) = lower(ac.called_address)
      GROUP BY 
        s.source_of_loss_contract_address, l.label, ac.count
      ORDER BY 
        occurrences DESC;
    `;

    const labelsOccurrences: LabelOccurrence[] = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      raw: true,
    });

    // Convert occurrences to number
    const formattedOccurrences = labelsOccurrences.map((item) => ({
      ...item,
      occurrences: Number(item.occurrences),
    }));

    return formattedOccurrences;
  } catch (error) {
    console.error(`Error in getSandwichLabelOccurrences: ${error}`);
    return null;
  }
}

export async function getFullSandwichTable(
  duration: string,
  page: number
): Promise<{ data: SandwichDetail[]; totalSandwiches: number }> {
  const { ids, totalSandwiches } = await getIdsForFullSandwichTable(duration, page);
  const enrichedSandwiches = await enrichSandwiches(ids);

  return { data: enrichedSandwiches, totalSandwiches };
}

export async function getSandwichTableContentForPool(
  poolAddress: string,
  duration: string,
  page: number
): Promise<{ data: SandwichDetail[]; totalSandwiches: number }> {
  const poolId = await getIdByAddressCaseInsensitive(poolAddress);
  if (!poolId) {
    throw new Error('Pool not found');
  }
  const { ids, totalSandwiches } = await getIdsForFullSandwichTableForPool(duration, poolId, page);
  const enrichedSandwiches = await enrichSandwiches(ids);
  return { data: enrichedSandwiches, totalSandwiches };
}
