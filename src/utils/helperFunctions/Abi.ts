import { Op, Sequelize } from "sequelize";
import { AbisEthereum } from "../../models/Abi.js";
import { ProxyCheck } from "../../models/ProxyCheck.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";
import { NULL_ADDRESS } from "./Constants.js";
import { getImplementationContractAddressErc1967, getImplementationContractAddressErc897 } from "./ProxyCheck.js";

class RateLimiter {
  private maxCallsPerInterval: number;
  private interval: number;
  private callsThisInterval: number;
  private currentIntervalStartedAt: number;

  constructor(maxCallsPerInterval: number, interval: number) {
    this.maxCallsPerInterval = maxCallsPerInterval;
    this.interval = interval;
    this.callsThisInterval = 0;
    this.currentIntervalStartedAt = Date.now();
  }

  private resetInterval() {
    this.callsThisInterval = 0;
    this.currentIntervalStartedAt = Date.now();
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
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
export async function updateAbiFromContractAddress(contractAddress: string, JsonRpcProvider: any, web3HttpProvider: any): Promise<any> {
  return rateLimiter.call(async () => {
    // Checking if the contract address exists in the new table
    const contractRecord = await ProxyCheck.findOne({
      where: {
        contractAddress: {
          [Op.iLike]: contractAddress,
        },
      },
    });

    // If the contract exists and is a proxy
    if (contractRecord && contractRecord.is_proxy_contract) {
      const implementationAddress = contractRecord.implementation_address;
      if (implementationAddress) {
        const existingAbi = await readAbiFromAbisEthereumTable(implementationAddress);
        if (existingAbi) return existingAbi;
      }
      // If ABI not found, fetching it from Etherscan using the implementation address
      return fetchAbiFromEtherscan(implementationAddress || contractAddress);
    }

    // If the contract is not a proxy or doesn't exist in the new table
    if (!contractRecord) {
      const implementationAddressErc1967 = await getImplementationContractAddressErc1967(contractAddress, JsonRpcProvider);
      if (implementationAddressErc1967 !== NULL_ADDRESS) {
        await handleUpsertProxyCheck(contractAddress, true, implementationAddressErc1967, ["EIP_1967"]);
        return fetchAbiFromEtherscan(implementationAddressErc1967);
      } else {
        const implementationAddressErc897 = await getImplementationContractAddressErc897(contractAddress, web3HttpProvider);
        if (implementationAddressErc897) {
          await handleUpsertProxyCheck(contractAddress, true, implementationAddressErc897, ["EIP_1967", "EIP_897"]);
          return fetchAbiFromEtherscan(implementationAddressErc897);
        } else {
          await handleUpsertProxyCheck(contractAddress, false, null, ["EIP_1967", "EIP_897"]);
        }
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
        } catch (err) {
          console.log(`Error storing Abi in AbisEthereum ${err}`);
        }
      }
    } else {
      return existingAbi;
    }

    return null;
  });
}

async function handleUpsertProxyCheck(contractAddress: string, isProxy: boolean, implementationAddress: string | null, standards: string[]) {
  // Find the record first
  const existingRecord = await ProxyCheck.findOne({ where: { contractAddress } });

  if (existingRecord) {
    // Ensure checked_standards is not null
    if (!existingRecord.checked_standards) {
      existingRecord.checked_standards = [];
    }

    // If record exists, append the standards if they're not present
    for (const standard of standards) {
      if (!existingRecord.checked_standards.includes(standard)) {
        existingRecord.checked_standards.push(standard);
      }
    }
    await existingRecord.save();
  } else {
    // If record doesn't exist, create it with the standards
    await ProxyCheck.create({
      contractAddress,
      is_proxy_contract: isProxy,
      implementation_address: implementationAddress,
      checked_standards: standards,
    });
  }
}
