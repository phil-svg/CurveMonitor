import { Sequelize } from "sequelize-typescript";
import { Labels } from "../../../models/Labels.js";

export async function findUniqueLabeledAddresses(): Promise<string[]> {
  const labels = await Labels.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("address")), "address"]],
  });
  return labels.map((label) => label.getDataValue("address"));
}
