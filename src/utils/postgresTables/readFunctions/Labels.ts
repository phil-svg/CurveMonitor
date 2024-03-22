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
    const lowerCaseAddress = address.toLowerCase();

    const labelRecord: Labels | null = await Labels.findOne({
      where: Sequelize.where(Sequelize.fn("lower", Sequelize.col("address")), lowerCaseAddress),
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

export async function findVyperContractAddresses(): Promise<string[]> {
  try {
    const labels = await Labels.findAll({
      where: {
        label: {
          [Op.iLike]: "Vyper_contract",
        },
      },
    });

    return labels.map((label) => label.getDataValue("address"));
  } catch (error) {
    console.error(`Error in findVyperContractAddresses: ${error}`);
    return [];
  }
}
