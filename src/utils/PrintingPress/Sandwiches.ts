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

export async function printLossCounts(): Promise<void> {
  const sandwiches = await Sandwiches.findAll({
    attributes: ["loss_transactions"],
    where: {
      loss_transactions: {
        [Op.ne]: null, // only get sandwiches with non-null loss_transactions
      },
    },
  });

  const lossCounts = {
    "0-10": 0,
    "10-100": 0,
    "100-1000": 0,
    "1000-10000": 0,
    ">10000": 0,
  };

  for (const sandwich of sandwiches) {
    // Check if there's at least one transaction in the loss_transactions array
    if (sandwich.loss_transactions!.length > 0) {
      const currentLoss = sandwich.loss_transactions![0].lossInUsd;

      // Increase the count for the appropriate loss range
      if (currentLoss <= 10) {
        lossCounts["0-10"]++;
      } else if (currentLoss <= 100) {
        lossCounts["10-100"]++;
      } else if (currentLoss <= 1000) {
        lossCounts["100-1000"]++;
      } else if (currentLoss <= 10000) {
        lossCounts["1000-10000"]++;
      } else {
        lossCounts[">10000"]++;
      }
    }
  }

  console.log("Loss counts:", lossCounts);
}
