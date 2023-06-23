import { Sequelize } from "sequelize-typescript";
import { Labels } from "../../../models/Labels.js";
import { Op } from "sequelize";

export async function findUniqueLabeledAddresses(): Promise<string[]> {
  const labels = await Labels.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("address")), "address"]],
  });
  return labels.map((label) => label.getDataValue("address"));
}

export async function getLabelNameFromAddress(address: string): Promise<string | null> {
  try {
    const labelRecord = await Labels.findOne({
      where: {
        address: {
          [Op.iLike]: address,
        },
      },
    });

    if (labelRecord) {
      return labelRecord.label;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error in getLabelNameFromAddress: ${error}`);
    return null;
  }
}
