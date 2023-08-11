import { Op } from "sequelize";
import { Contracts } from "../../../models/Contracts.js";
export async function getContractInceptionTimestamp(contractAddress) {
    const lowerCasedAddress = contractAddress.toLowerCase();
    const contract = await Contracts.findOne({
        where: {
            contractAddress: {
                [Op.iLike]: lowerCasedAddress,
            },
        },
    });
    return (contract === null || contract === void 0 ? void 0 : contract.contractCreationTimestamp) || null;
}
//# sourceMappingURL=Contracts.js.map