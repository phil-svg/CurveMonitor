import { AbisEthereum } from "../../models/Abi.js";
import { fetchAbiFromEtherscan } from "../postgresTables/Abi.js";
import { readAbiFromAbisEthereumTable } from "../postgresTables/readFunctions/Abi.js";

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

export async function updateAbiFromContractAddress(contractAddress: string): Promise<any> {
  return rateLimiter.call(async () => {
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
