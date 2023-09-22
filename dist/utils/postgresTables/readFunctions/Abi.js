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
export async function getAbiFromAbisEthereumTable(contractAddress) {
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
export async function storeAbiInDb(contractAddress, abi) {
    try {
        await AbisEthereum.create({
            contract_address: contractAddress,
            abi,
        });
    }
    catch (err) {
        console.log(`Error storing Abi in AbisEthereum ${err}`);
    }
}
//# sourceMappingURL=Abi.js.map