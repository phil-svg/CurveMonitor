import { AddressesCalledCounts } from "../../models/AddressesCalledCount.js";
import { TransactionCalls } from "../../models/TransactionCalls.js";
export async function updateAddressCounts() {
    try {
        // Fetch all called addresses from the TransactionCalls table
        const transactionCalls = await TransactionCalls.findAll({
            attributes: ["called_address"],
            raw: true,
        });
        // Calculate the counts for each address
        const addressCounts = {}; // Explicitly define the type of addressCounts
        for (let call of transactionCalls) {
            if (addressCounts[call.called_address]) {
                addressCounts[call.called_address]++;
            }
            else {
                addressCounts[call.called_address] = 1;
            }
        }
        // Populate the AddressCounts table
        for (let address in addressCounts) {
            const count = addressCounts[address];
            // Either find and update an existing row or create a new one
            const [instance, created] = await AddressesCalledCounts.findOrCreate({
                where: { called_address: address },
                defaults: { count: count },
            });
            if (!created) {
                instance.count = count;
                await instance.save();
            }
        }
        console.log("AddressCounts table has been updated.");
    }
    catch (error) {
        console.error(`Error in updateAddressCounts: ${error}`);
    }
}
//# sourceMappingURL=currentthing.js.map