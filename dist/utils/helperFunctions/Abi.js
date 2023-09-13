import { AbisEthereum } from "../../models/Abi.js";
import { ProxyCheck } from "../../models/ProxyCheck.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";
import { NULL_ADDRESS } from "./Constants.js";
import { getImplementationContractAddress } from "./ProxyCheck.js";
class RateLimiter {
    constructor(maxCallsPerInterval, interval) {
        this.maxCallsPerInterval = maxCallsPerInterval;
        this.interval = interval;
        this.callsThisInterval = 0;
        this.currentIntervalStartedAt = Date.now();
    }
    resetInterval() {
        this.callsThisInterval = 0;
        this.currentIntervalStartedAt = Date.now();
    }
    async call(fn) {
        if (Date.now() - this.currentIntervalStartedAt > this.interval) {
            this.resetInterval();
        }
        if (this.callsThisInterval >= this.maxCallsPerInterval) {
            await new Promise((resolve) => setTimeout(resolve, this.interval - (Date.now() - this.currentIntervalStartedAt)));
            this.resetInterval();
        }
        this.callsThisInterval++;
        return await fn();
    }
}
// Initializing the rate limiter to allow up to 5 calls per sec
const rateLimiter = new RateLimiter(5, 1000);
/**
 * Fetches the ABI for the given contract address.
 *
 * @param contractAddress - The contract address for which the ABI is required.
 * @returns The ABI as a JSON array.
 */
export async function updateAbiFromContractAddress(contractAddress, JsonRpcProvider) {
    return rateLimiter.call(async () => {
        // Checking if the contract address exists in the new table
        const contractRecord = await ProxyCheck.findOne({ where: { contractAddress } });
        // If the contract exists and is a proxy
        if (contractRecord && contractRecord.is_proxy_contract) {
            const implementationAddress = contractRecord.implementation_address;
            if (implementationAddress) {
                const existingAbi = await readAbiFromAbisEthereumTable(implementationAddress);
                if (existingAbi)
                    return existingAbi;
            }
            // If ABI not found, fetching it from Etherscan using the implementation address
            return fetchAbiFromEtherscan(implementationAddress || contractAddress);
        }
        // If the contract is not a proxy or doesn't exist in the new table
        if (!contractRecord) {
            const implementationAddress = await getImplementationContractAddress(contractAddress, JsonRpcProvider);
            if (implementationAddress !== NULL_ADDRESS) {
                // If an implementation address is found, saving it as a proxy in the new table
                await ProxyCheck.upsert({
                    contractAddress,
                    is_proxy_contract: true,
                    implementation_address: implementationAddress,
                });
                // Fetching ABI from Etherscan using the implementation address
                return fetchAbiFromEtherscan(implementationAddress);
            }
            else {
                // If not a proxy, adding it to the new table
                await ProxyCheck.upsert({
                    contractAddress,
                    is_proxy_contract: false,
                });
            }
        }
        // Fetching ABI either from the DB or Etherscan
        const existingAbi = await readAbiFromAbisEthereumTable(contractAddress);
        if (!existingAbi) {
            const fetchedAbi = await fetchAbiFromEtherscan(contractAddress);
            if (fetchedAbi && fetchedAbi.length) {
                try {
                    await AbisEthereum.create({
                        contract_address: contractAddress,
                        abi: fetchedAbi,
                    });
                    return fetchedAbi;
                }
                catch (err) {
                    console.log(`Error storing Abi in AbisEthereum ${err}`);
                }
            }
        }
        else {
            return existingAbi;
        }
        return null;
    });
}
//# sourceMappingURL=Abi.js.map