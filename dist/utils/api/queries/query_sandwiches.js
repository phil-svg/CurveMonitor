import { Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { getLabelNameFromAddress } from "../../postgresTables/readFunctions/Labels.js";
import { AddressesCalledCounts } from "../../../models/AddressesCalledCount.js";
import { getIdsForFullSandwichTable, getIdsForFullSandwichTableForPool } from "../../postgresTables/readFunctions/Sandwiches.js";
import { enrichSandwiches } from "../../postgresTables/readFunctions/SandwichDetailEnrichments.js";
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
export async function getLabelsRankingDecendingAbsOccurences() {
    try {
        // Fetch the count of each source_of_loss_contract_address
        const counts = (await Sandwiches.findAll({
            attributes: ["source_of_loss_contract_address", [Sequelize.fn("COUNT", Sequelize.col("source_of_loss_contract_address")), "count"]],
            group: ["source_of_loss_contract_address"],
            raw: true,
        }));
        // For each unique address, get its label
        const labelsOccurrences = [];
        for (const countObj of counts) {
            const address = countObj.source_of_loss_contract_address;
            if (!address) {
                console.log(`err with address ${address} in labelsOccurrences`);
                continue;
            }
            let label = await getLabelNameFromAddress(address);
            if (!label)
                label = address;
            labelsOccurrences.push({ address, label, occurrences: parseInt(countObj.count) });
        }
        // Sort labelsOccurrences in descending order of count
        labelsOccurrences.sort((a, b) => b.occurrences - a.occurrences);
        return labelsOccurrences;
    }
    catch (error) {
        console.error(`Error in getLabelsRankingDecendingAbsOccurences: ${error}`);
        return null;
    }
}
export async function getSandwichLabelOccurrences() {
    try {
        const labelsRanking = await getLabelsRankingDecendingAbsOccurences();
        // If labelsRanking is null, something went wrong in getLabelsRankingDecendingAbsOccurences
        if (!labelsRanking) {
            console.error("Error: getLabelsRankingDecendingAbsOccurences returned null.");
            return null;
        }
        // For each unique address, get its count in AddressesCalledCounts
        const labelsOccurrences = [];
        for (const labelRanking of labelsRanking) {
            const address = labelRanking.address;
            if (!address) {
                console.log(`err with address ${address} in labelsOccurrences`);
                continue;
            }
            // Fetch address count from AddressesCalledCounts table
            const addressCountRecord = await AddressesCalledCounts.findOne({ where: { called_address: address } });
            const allTxCount = addressCountRecord ? addressCountRecord.count : 0;
            labelsOccurrences.push(Object.assign(Object.assign({}, labelRanking), { numOfAllTx: allTxCount }));
        }
        return labelsOccurrences;
    }
    catch (error) {
        console.error(`Error in getSandwichLabelOccurrences: ${error}`);
        return null;
    }
}
export async function getFullSandwichTable(duration, page) {
    const { ids, totalPages } = await getIdsForFullSandwichTable(duration, page);
    const enrichedSandwiches = await enrichSandwiches(ids);
    return { data: enrichedSandwiches, totalPages };
}
export async function getSandwichTableContentForPool(poolId, duration, page) {
    const { ids, totalPages } = await getIdsForFullSandwichTableForPool(duration, poolId, page);
    const enrichedSandwiches = await enrichSandwiches(ids);
    return { data: enrichedSandwiches, totalPages };
}
//# sourceMappingURL=query_sandwiches.js.map