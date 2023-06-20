import { PoolCountFromProvider } from "../../../models/PoolCountFromProvider";
// Fetches all addresses from the PoolCountFromProvider table.
export const getAllAddressesFromProvider = async () => {
    const allRecords = await PoolCountFromProvider.findAll();
    if (!allRecords || allRecords.length === 0) {
        return null;
    }
    const addresses = allRecords.map((record) => record.address);
    return addresses;
};
//# sourceMappingURL=PoolCountFromProvider.js.map