import { getWeb3WsProvider } from "../helperFunctions/Web3";
import { getAbiByForAddressProvider, updatePoolAbis } from "../postgresTables/Abi";
import { updatePools } from "../postgresTables/Pools";
import { getAllAddressesFromProvider } from "../postgresTables/readFunctions/PoolCountFromProvider";
import { getAllPoolAddresses } from "../postgresTables/readFunctions/Pools";
import eventEmitter from "./EventEmitter";
import { updateCoinTable } from "../postgresTables/Coins";
// when histo-parsing is finished, subscribe to new events.
export async function preparingLiveModeForRawEvents() {
    eventEmitter.on("ready for new pool subscription", subscribeToNewPools);
}
async function subscribeToNewPools() {
    const ADDRESSES = await getAllAddressesFromProvider();
    if (!ADDRESSES)
        return;
    for (const ADDRESS of ADDRESSES) {
        subscribe(ADDRESS);
    }
}
async function subscribe(ADDRESS) {
    const web3 = getWeb3WsProvider();
    const ABI = await getAbiByForAddressProvider({ address: ADDRESS });
    if (!ABI)
        return;
    const contract = new web3.eth.Contract(ABI, ADDRESS);
    if (!contract)
        return;
    contract.events
        .allEvents({ fromBlock: "latest" })
        .on("data", async () => {
        handleProviderEvent;
    })
        .on("error", (err) => console.log("err in subscribe with address", ADDRESS, err));
}
async function handleProviderEvent() {
    const allPoolAddressesBefore = await getAllPoolAddresses();
    await updatePools();
    await updateCoinTable();
    await updatePoolAbis();
    const allPoolAddressesAfter = await getAllPoolAddresses();
    // Get new pool addresses by filtering those which were not present before update
    const newPoolAddresses = allPoolAddressesAfter.filter((address) => !allPoolAddressesBefore.includes(address));
    // Emit event for each new pool address
    for (const poolAddress of newPoolAddresses) {
        console.log("spotted new pool with the address", poolAddress);
        eventEmitter.emit("ready for subscription", poolAddress);
    }
}
//# sourceMappingURL=PoolsLive.js.map