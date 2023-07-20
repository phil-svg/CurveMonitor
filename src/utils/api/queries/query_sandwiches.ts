import { Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { getLabelNameFromAddress } from "../../postgresTables/readFunctions/Labels.js";
import { AddressesCalledCounts } from "../../../models/AddressesCalledCount.js";
import { getIdsForFullSandwichTable } from "../../postgresTables/readFunctions/Sandwiches.js";
import { SandwichDetail, enrichSandwiches } from "../../postgresTables/readFunctions/SandwichDetailEnrichments.js";
import { getTransactionIdsForPool } from "./query_transactions.js";

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

export async function getLabelsRankingDecendingAbsOccurences(): Promise<{ address: string; label: string; occurrences: number }[] | null> {
  try {
    // Fetch the count of each source_of_loss_contract_address
    const counts = (await Sandwiches.findAll({
      attributes: ["source_of_loss_contract_address", [Sequelize.fn("COUNT", Sequelize.col("source_of_loss_contract_address")), "count"]],
      group: ["source_of_loss_contract_address"],
      raw: true,
    })) as unknown as { source_of_loss_contract_address: string; count: string }[];

    // For each unique address, get its label
    const labelsOccurrences: { address: string; label: string; occurrences: number }[] = [];
    for (const countObj of counts) {
      const address = countObj.source_of_loss_contract_address;
      if (!address) {
        console.log(`err with address ${address} in labelsOccurrences`);
        continue;
      }
      let label = await getLabelNameFromAddress(address);
      if (!label) label = address;
      labelsOccurrences.push({ address, label, occurrences: parseInt(countObj.count) });
    }

    // Sort labelsOccurrences in descending order of count
    labelsOccurrences.sort((a, b) => b.occurrences - a.occurrences);

    return labelsOccurrences;
  } catch (error) {
    console.error(`Error in getLabelsRankingDecendingAbsOccurences: ${error}`);
    return null;
  }
}

export async function getSandwichLabelOccurrences(): Promise<{ address: string; label: string; occurrences: number; numOfAllTx: number }[] | null> {
  try {
    const labelsRanking = await getLabelsRankingDecendingAbsOccurences();

    // If labelsRanking is null, something went wrong in getLabelsRankingDecendingAbsOccurences
    if (!labelsRanking) {
      console.error("Error: getLabelsRankingDecendingAbsOccurences returned null.");
      return null;
    }

    // For each unique address, get its count in AddressesCalledCounts
    const labelsOccurrences: { address: string; label: string; occurrences: number; numOfAllTx: number }[] = [];
    for (const labelRanking of labelsRanking) {
      const address = labelRanking.address;
      if (!address) {
        console.log(`err with address ${address} in labelsOccurrences`);
        continue;
      }

      // Fetch address count from AddressesCalledCounts table
      const addressCountRecord = await AddressesCalledCounts.findOne({ where: { called_address: address } });
      const allTxCount = addressCountRecord ? addressCountRecord.count : 0;

      labelsOccurrences.push({ ...labelRanking, numOfAllTx: allTxCount });
    }

    return labelsOccurrences;
  } catch (error) {
    console.error(`Error in getSandwichLabelOccurrences: ${error}`);
    return null;
  }
}

export async function getFullSandwichTable(duration: string): Promise<SandwichDetail[]> {
  const sandwichIds = await getIdsForFullSandwichTable(duration);
  const enrichedSandwiches = await enrichSandwiches(sandwichIds);
  return enrichedSandwiches;
}

export async function getSandwichTableContentForPool(poolId: number, duration: string): Promise<SandwichDetail[]> {
  const sandwichIds = await getTransactionIdsForPool(duration, poolId);
  const enrichedSandwiches = await enrichSandwiches(sandwichIds);
  return enrichedSandwiches;
}
