import { Op } from "sequelize";
import { ProxyCheck } from "../../../models/ProxyCheck.js";
export async function getImplementationAddressFromTable(contractAddress) {
    const record = await ProxyCheck.findOne({
        where: {
            contractAddress: contractAddress,
        },
    });
    if (record && record.is_proxy_contract) {
        return record.implementation_address;
    }
    return null;
}
export async function findContractInProxyCheck(contractAddress) {
    const contractRecord = await ProxyCheck.findOne({
        where: {
            contractAddress: {
                [Op.iLike]: contractAddress,
            },
        },
    });
    return contractRecord;
}
export async function createProxyCheckRecord(contractAddress, isProxy, implementationAddress, standards) {
    await ProxyCheck.create({
        contractAddress,
        is_proxy_contract: isProxy,
        implementation_address: implementationAddress,
        checked_standards: standards,
    });
}
//# sourceMappingURL=ProxyCheck.js.map