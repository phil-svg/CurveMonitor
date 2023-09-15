import { ProxyCheck } from "../../../models/ProxyCheck.js";
export async function getProxyImplementationAddress(contractAddress) {
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
//# sourceMappingURL=ProxyCheck.js.map