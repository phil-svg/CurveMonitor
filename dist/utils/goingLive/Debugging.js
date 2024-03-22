import { getContractByAddressWithWebsocket } from "../helperFunctions/Web3.js";
import { getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
export async function subscribeToAddress(address) {
    const contract = await getContractByAddressWithWebsocket(address);
    const poolId = await getIdByAddress(address);
    if (!contract)
        return;
    if (!poolId)
        return;
    const subscription = contract.events
        .allEvents({ fromBlock: "latest" })
        .on("data", async (event) => {
        console.log(`New Event spotted for ${address}`);
    })
        .on("error", (error) => {
        console.log(`Subscription error: ${error}`);
    })
        .on("connected", (subscriptionId) => {
        // console.log(`Subscription connected with id: ${subscriptionId}`);
        activeSubscriptions[subscriptionId] = subscription; // store subscription object
    });
    // storing the subscription object for later unsubscription
    activeSubscriptions[address] = subscription;
}
//# sourceMappingURL=Debugging.js.map