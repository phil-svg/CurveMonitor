import { logProgress, updateConsoleOutput } from '../helperFunctions/QualityOfLifeStuff.js';
import { TransactionDetails } from '../../models/TransactionDetails.js';
import { Contracts } from '../../models/Contracts.js';
import axios from 'axios';
import { WEB3_HTTP_PROVIDER, getBlockTimeStampFromNode, getTxWithLimiter } from '../web3Calls/generic.js';
import { ContractDetail } from '../Interfaces.js';
// import { getBlockTimestamps } from "../subgraph/Blocktimestamps.js";
import { getInceptionBlock } from './Pools.js';
import { Op } from 'sequelize';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchContractAgeInRealtime(
  txHash: string,
  calledContractAddress: string
): Promise<{ blockNumber: number; timestamp: number }> {
  try {
    // Convert the provided address to lowercase for the check
    const lowerCasedAddress = calledContractAddress.toLowerCase();

    // Check if the contract's inception timestamp already exists in the database
    const existingContract = await Contracts.findOne({
      where: {
        contractAddress: {
          [Op.iLike]: lowerCasedAddress,
        },
      },
    });

    if (existingContract && existingContract.contractCreationTimestamp) {
      return {
        blockNumber: existingContract.contractCreationBlock!,
        timestamp: existingContract.contractCreationTimestamp,
      };
    }

    // If we don't have the data in the database, we use our primary method to fetch it
    return await fetchContractInception(txHash, calledContractAddress);
  } catch (error) {
    console.error('Error in fetchContractAgeInRealtime:', error);
    throw error;
  }
}

async function fetchContractInception(
  txHash: string,
  calledContractAddress: string
): Promise<{ blockNumber: number; timestamp: number }> {
  const highestBlock = await WEB3_HTTP_PROVIDER.eth.getBlockNumber();

  const inceptionBlock: number | null = await getInceptionBlock(highestBlock, calledContractAddress);

  if (inceptionBlock === null) {
    throw new Error('Failed to get the inception block.');
  }

  const block = await WEB3_HTTP_PROVIDER.eth.getBlock(inceptionBlock);

  return {
    blockNumber: inceptionBlock,
    timestamp: Number(block.timestamp),
  };
}

export async function fetchContractDetailsFromEtherscan(contractAddresses: string[]): Promise<ContractDetail[]> {
  try {
    const response = await axios.get('https://api.etherscan.io/api', {
      params: {
        module: 'contract',
        action: 'getcontractcreation',
        contractaddresses: contractAddresses.join(','),
        apikey: process.env.ETHERSCAN_KEY,
      },
    });

    if (response.data.status !== '1') {
      throw new Error(`Failed to fetch contract details from Etherscan: ${response.data.message || 'Unknown error'}`);
    }

    return response.data.result;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`Axios error code: ${error.code}`);
    } else {
      console.error(`Error fetching contract details: ${error.message}`);
    }
    throw error;
  }
}

async function fetchMissingBlockNumbers(): Promise<void> {
  const contractsMissingBlocks = await Contracts.findAll({
    where: {
      contractCreationBlock: null,
    },
    raw: true,
  });

  for (let contract of contractsMissingBlocks) {
    const tx = await getTxWithLimiter(contract.creationTransactionHash);
    if (tx && tx.blockNumber) {
      await Contracts.update(
        { contractCreationBlock: tx.blockNumber },
        { where: { contractAddress: contract.contractAddress } }
      );
    }
  }
}

export async function saveContractDetails(contractData: any[]): Promise<void> {
  for (let contract of contractData) {
    const existingContractByTxHash = await Contracts.findOne({
      where: { creationTransactionHash: contract.txHash },
    });

    if (existingContractByTxHash) {
      continue;
    }

    const existingContract = await Contracts.findOne({
      where: { contractAddress: contract.contractAddress },
    });

    if (!existingContract) {
      const newContract = await Contracts.create({
        contractAddress: contract.contractAddress,
        creatorAddress: contract.contractCreator,
        creationTransactionHash: contract.txHash,
      });

      const tx = await getTxWithLimiter(contract.txHash);
      if (tx && tx.blockNumber) {
        const blockTimestamps = await getBlockTimeStampFromNode(Number(tx.blockNumber));
        await newContract.update({
          contractCreationBlock: tx.blockNumber,
          contractCreationTimestamp: Number(blockTimestamps),
        });
      }
    }
  }
}

async function getUniqueContractAddressesFromTxDetails(): Promise<string[]> {
  const result = await TransactionDetails.findAll({
    attributes: ['to'],
    group: ['to'],
    raw: true,
  });

  return result.map((entry) => entry.to);
}

async function getStoredContractAddresses(): Promise<string[]> {
  const contracts = await Contracts.findAll({
    attributes: ['contractAddress'],
    raw: true,
  });

  return contracts.map((contract) => contract.contractAddress);
}

async function solveMissingContracts(): Promise<void> {
  const missingAddresses = await getMissingAddresses();
  const BATCH_SIZE = 5;
  const totalToBeFetched = missingAddresses.length;
  let fetchedCount = 0;
  let totalTimeTaken = 0;

  for (let i = 0; i < missingAddresses.length; i += BATCH_SIZE) {
    const startTime = new Date().getTime();

    const batch = missingAddresses.slice(i, i + BATCH_SIZE);

    try {
      const contractDetails = await fetchContractDetailsFromEtherscan(batch);
      await saveContractDetails(contractDetails);

      fetchedCount += Math.min(BATCH_SIZE, missingAddresses.length - i);

      if (i + BATCH_SIZE < missingAddresses.length) {
        await delay(210);
      }

      const endTime = new Date().getTime();
      totalTimeTaken += endTime - startTime;
      logProgress('solveMissingContracts', 50, fetchedCount, totalTimeTaken, totalToBeFetched);
    } catch (error) {
      console.error('Error processing missing contracts batch:', batch, (error as any).response?.data || error);
    }
  }
}

async function getMissingAddresses(): Promise<string[]> {
  const txDetailsAddresses = (await getUniqueContractAddressesFromTxDetails())
    .filter((addr) => addr !== null && addr !== undefined)
    .map((addr) => addr.toLowerCase());

  const storedAddressesSet = new Set((await getStoredContractAddresses()).map((addr) => addr.toLowerCase()));

  const missingAddresses = txDetailsAddresses.filter((addr) => !storedAddressesSet.has(addr));

  return missingAddresses;
}

async function main() {
  await fetchMissingBlockNumbers();
  await solveMissingContracts();
}

export async function updateContractCreations(): Promise<void> {
  await main();
  updateConsoleOutput('[✓] Contract creations synced successfully.\n');
}
