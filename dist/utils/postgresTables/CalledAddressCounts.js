import { AddressesCalledCounts } from "../../models/AddressesCalledCount.js";
import { TransactionDetails } from "../../models/TransactionDetails.js";
async function updateAddressCountsInterval() {
    try {
        // Fetch all called addresses from the TransactionDetails table
        const transactionCalls = await TransactionDetails.findAll({
            attributes: ["to"],
            raw: true,
        });
        // Calculate the counts for each address
        const addressCounts = {}; // Explicitly define the type of addressCounts
        for (let call of transactionCalls) {
            if (call.to) {
                // Check if the address is not null or undefined
                if (addressCounts[call.to]) {
                    addressCounts[call.to]++;
                }
                else {
                    addressCounts[call.to] = 1;
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