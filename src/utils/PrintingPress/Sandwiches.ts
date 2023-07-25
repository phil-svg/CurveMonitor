import { Op } from "sequelize";
import { Sandwiches } from "../../models/Sandwiches.js";

/**
 * The purpose of this function is to provide a way to quickly check the total
 * impact of the loss transactions, measured in USD, across all sandwiches
 * in the database.
 */
export async function printEntireCombinedSandwichLossInUsd(): Promise<void> {
  const sandwiches = await Sandwiches.findAll({
    attributes: ["loss_transactions"],
    where: {
      loss_transactions: {
        [Op.ne]: null, // only get sandwiches with non-null loss_transactions
      },
    },
  });

  let totalLossInUsd = 0;

  for (const sandwich of sandwiches) {
    // Check if there's at least one transaction in the loss_transactions array
    if (sandwich.loss_transactions!.length > 0) {
      totalLossInUsd += sandwich.loss_transactions![0].lossInUsd;
    }
  }

  console.log("totalLossInUsd", Math.round(totalLossInUsd));
}
