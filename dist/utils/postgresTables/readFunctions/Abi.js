import { AbisEthereum } from "../../../models/Abi.js";
export async function readAbiFromAbisEthereumTable(contractAddress) {
    const record = await AbisEthereum.findOne({ where: { contract_address: contractAddress } });
    // Return the ABI if found, otherwise return null
    return record ? record.abi : null;
}
//# sourceMappingURL=Abi.js.map