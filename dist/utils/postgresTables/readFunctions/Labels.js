import { Sequelize } from "sequelize-typescript";
import { Labels } from "../../../models/Labels.js";
import { Op } from "sequelize";
export async function findUniqueLabeledAddresses() {
    const labels = await Labels.findAll({
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("address")), "address"]],
    });
    return labels.map((label) => label.getDataValue("address"));
}
export async function getLabelNameFromAddress(address) {
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
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error(`Error in getLabelNameFromAddress: ${error}`);
        return null;
    }
}
export async function findVyperContractAddresses() {
    try {
        const labels = await Labels.findAll({
            where: {
                label: {
                    [Op.iLike]: "Vyper_contract",
                },
            },
        });
        return labels.map((label) => label.getDataValue("address"));
    }
    catch (error) {
        console.error(`Error in findVyperContractAddresses: ${error}`);
        return [];
    }
}
//# sourceMappingURL=Labels.js.map