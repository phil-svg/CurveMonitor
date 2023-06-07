import { Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";

export async function readSandwichesInBatches(batchSize: number = 100): Promise<{ id: number; loss_transactions: any }[][]> {
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

export async function findUniqueSourceOfLossAddresses(): Promise<string[]> {
  const sandwiches = await Sandwiches.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("source_of_loss_contract_address")), "source_of_loss_contract_address"]],
  });
  return sandwiches.map((sandwich) => sandwich.getDataValue("source_of_loss_contract_address"));
}
