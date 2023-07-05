import { AddressesCalledCounts } from "../../models/AddressesCalledCount.js";
import { TransactionCalls } from "../../models/TransactionCalls.js";
async function updateAddressCountsInterval() {
    try {
        // Fetch all called addresses from the TransactionCalls table
        const transactionCalls = await TransactionCalls.findAll({
            attributes: ["called_address"],
            raw: true,
        });
        // Calculate the counts for each address
        const addressCounts = {}; // Explicitly define the type of addressCounts
        for (let call of transactionCalls) {
            if (call.called_address) {
                // Check if the address is not null or undefined
                if (addressCounts[call.called_address]) {
                    addressCounts[call.called_address]++;
                }
                else {
                    addressCounts[call.called_address] = 1;
                }
            }
        }
        // Populate the AddressCounts table
        for (let address in addressCounts) {
            const count = addressCounts[address];
            // Find and update an existing row, or create a new one
            const [instance, created] = await AddressesCalledCounts.upsert({
                called_address: address,
                count: count,
            });
            if (!created) {
                instance.count = count;
                await instance.save();
            }
        }
    }
    catch (error) {
        console.error(`Error in updateAddressCounts: ${error}`);
    }
}
export async function updateAddressCounts() {
    // Run the function immediately and then every 5 min
    updateAddressCountsInterval();
    setInterval(updateAddressCountsInterval, 5 * 60 * 1000);
}
//# sourceMappingURL=CalledAddressCounts.js.map