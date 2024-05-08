import { QueryTypes } from 'sequelize';
import { Sandwiches } from '../../../models/Sandwiches.js';
import { getIdsForFullSandwichTable, getIdsForFullSandwichTableForPool, } from '../../postgresTables/readFunctions/Sandwiches.js';
import { enrichSandwiches } from '../../postgresTables/readFunctions/SandwichDetailEnrichments.js';
import { getIdByAddressCaseInsensitive } from '../../postgresTables/readFunctions/Pools.js';
import { sequelize } from '../../../config/Database.js';
export async function getTotalAmountOfSandwichesInLocalDB() {
    const count = await Sandwiches.count();
    return count;
}
export async function getTotalExtractedFromCurve() {
    const count = await Sandwiches.count({
        where: {
            extracted_from_curve: true,
        },
    });
    return count;
}
export async function getLabelsRankingDescendingAbsOccurrences() {
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
        const labelsOccurrences = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
        });
        return labelsOccurrences;
    }
    catch (error) {
        console.error(`Error in getLabelsRankingDescendingAbsOccurrences: ${error}`);
        return null;
    }
}
export async function getSandwichLabelOccurrences() {
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
        const labelsOccurrences = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
        });
        return labelsOccurrences;
    }
    catch (error) {
        console.error(`Error in getSandwichLabelOccurrences: ${error}`);
        return null;
    }
}
export async function getFullSandwichTable(duration, page) {
    const { ids, totalSandwiches } = await getIdsForFullSandwichTable(duration, page);
    const enrichedSandwiches = await enrichSandwiches(ids);
    return { data: enrichedSandwiches, totalSandwiches };
}
export async function getSandwichTableContentForPool(poolAddress, duration, page) {
    const poolId = await getIdByAddressCaseInsensitive(poolAddress);
    if (!poolId) {
        throw new Error('Pool not found');
    }
    const { ids, totalSandwiches } = await getIdsForFullSandwichTableForPool(duration, poolId, page);
    const enrichedSandwiches = await enrichSandwiches(ids);
    return { data: enrichedSandwiches, totalSandwiches };
}
//# sourceMappingURL=query_sandwiches.js.map