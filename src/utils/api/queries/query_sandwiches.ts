import { Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { getLabelNameFromAddress } from "../../postgresTables/readFunctions/Labels.js";

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
