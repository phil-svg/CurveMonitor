import { Op } from "sequelize";
import { AbisEthereum } from "../../../models/Abi.js";
export async function readAbiFromAbisEthereumTable(contractAddress) {
    const record = await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    // Return the ABI if found, otherwise return null
    return record ? record.abi : null;
}
export async function getAbiFromAbisEthereum(contractAddress) {
    return await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddress,
            },
        },
    });
}
export async function isContractVerified(contractAddress) {
    const record = await AbisEthereum.findOne({
        where: {
            contract_address: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    return record ? record.is_verified === true : false;
}
//# sourceMappingURL=Abi.js.map