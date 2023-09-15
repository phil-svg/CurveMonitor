import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import Web3 from "web3";
import { getAbiBy, isAbiStored, fetchAbiFromEtherscan, storeAbiForAddressProvider } from "./postgresTables/Abi.js";
// only requires the address of the Address-Provider.
// Collects addresses provided together with their ABIs.
console.clear();
if (!process.env.WEB3_WSS) {
    console.error("Error: WEB3_WSS environment variable is not defined.");
    process.exit(1);
}
const WEB3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS));
export async function getProvidedAddress() {
    const TABLE_NAME = "AbisRelatedToAddressProvider";
    const ADDRESS_ADDRESSPROVIDER = "0x0000000022D53366457F9d5E68Ec105046FC4383";
    const ABI = await getAbiBy(TABLE_NAME, { address: ADDRESS_ADDRESSPROVIDER });
    if (!ABI) {
        console.log(`Please provide the ABI for the Address Provider Contract`);
        return null;
    }
    const CONTRACT_ADDRESS_PROVIDER = new WEB3.eth.Contract(ABI, ADDRESS_ADDRESSPROVIDER);
    const MAX_ID = Number(await CONTRACT_ADDRESS_PROVIDER.methods.max_id().call());
    const ADDRESS_ARR = [];
    for (var i = 0; i <= MAX_ID; i++) {
        const ADDRESS = await CONTRACT_ADDRESS_PROVIDER.methods.get_address(i).call();
        if (ADDRESS === "0x0000000000000000000000000000000000000000")
            continue;
        ADDRESS_ARR.push(ADDRESS);
    }
    return ADDRESS_ARR;
}
async function storeAbisForProvidedAddresses(ADDRESS_ARR) {
    const TABLE_NAME = "AbisRelatedToAddressProvider";
    for (const ADDRESS of ADDRESS_ARR) {
        if (!(await isAbiStored(TABLE_NAME, ADDRESS))) {
            await new Promise((resolve) => setTimeout(resolve, 200)); // ethersans' rate limit is 5 calls / second
            const ABI = await fetchAbiFromEtherscan(ADDRESS);
            if (!ABI)
                continue;
            await storeAbiForAddressProvider(ADDRESS, ABI);
        }
    }
}
export async function loadAddressProvider() {
    const PROVIDED_ADDRESSES = await getProvidedAddress();
    if (PROVIDED_ADDRESSES) {
        await storeAbisForProvidedAddresses(PROVIDED_ADDRESSES);
        console.log("[✓] Address Provider Contracts synced successfully.");
    }
    else {
        console.log("Error syncing Address Provider Contracts.");
    }
}
//# sourceMappingURL=AddressProviderEntryPoint.js.map