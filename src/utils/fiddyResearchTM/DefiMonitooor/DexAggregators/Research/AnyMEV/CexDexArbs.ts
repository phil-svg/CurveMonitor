import { chownSync } from 'fs';
import { ReadableTokenTransfer } from '../../../../../Interfaces.js';
import {
  addressIsWhitelisted,
  isLeafAddress,
  removeEthWrapsAndUnwraps,
} from '../../../../../postgresTables/mevDetection/cexdex/utils/cexdexDetection.js';
import { filterSmallAmountsFromCleanedTransfers } from '../../../../../postgresTables/readFunctions/CleanedTransfers.js';
import { isGlobalBackrunForChainFuzzyWOdb } from './AtomicArbs.js';
import { ChainName, fetchAbiFromEtherscanForChain } from './CleanTransfersWOdb.js';

async function wasPoolContractCalledDirectly(poolContractAddress: string, to: string) {
  const toLower = to.toLowerCase();

  // Check if 'to' address exists in the list of all pool addresses (case-insensitive)
  const isDirectCall = poolContractAddress.toLowerCase() === toLower;

  return isDirectCall;
}

export async function isCexDexArbCandidateWOdb(
  from: string,
  to: string,
  txDetails: any,
  numOfTransfers: number,
  cleanedTransfers: ReadableTokenTransfer[]
): Promise<boolean> {
  // if (hasIllegalOutbound(from, to, cleanedTransfers)) return false; debugging, rerunning

  // Define the logic for numOfTransfers
  switch (numOfTransfers) {
    case 2:
      return true; // If there are exactly two transfers, return true
    case 3:
      return true; // debugging for Aero

      // Check if "to" either received ETH from "from" address or sent ETH to a leaf address
      return cleanedTransfers.some(
        (transfer) =>
          transfer.tokenSymbol === 'ETH' &&
          ((transfer.from.toLowerCase() === from.toLowerCase() && transfer.to.toLowerCase() === to.toLowerCase()) ||
            (transfer.from.toLowerCase() === to.toLowerCase() && isLeafAddress(transfer.to, cleanedTransfers)))
      );
    case 4:
      // Check if the other two transfers are ETH, and one is sent to "to" from "from", and one is "to" sending ETH to leaf
      const ethTransfers = cleanedTransfers.filter((transfer) => transfer.tokenSymbol === 'ETH');
      return (
        ethTransfers.some(
          (transfer) =>
            transfer.from.toLowerCase() === from.toLowerCase() && transfer.to.toLowerCase() === to.toLowerCase()
        ) &&
        ethTransfers.some(
          (transfer) => transfer.from.toLowerCase() === to.toLowerCase() && isLeafAddress(transfer.to, cleanedTransfers)
        )
      );
    default:
      return false; // If none of the above cases match, return false
  }
}

export async function isCexDexArbWOdb(
  cleanedTransfers: ReadableTokenTransfer[],
  from: string,
  to: string,
  blockNumber: number,
  txPosition: number,
  txDetails: any,
  poolContractAddress: string,
  web3HttpProvider: any,
  chain: ChainName
): Promise<boolean | 'unable to fetch'> {
  let numOfTransfers = cleanedTransfers.length;
  if (!numOfTransfers) return 'unable to fetch';

  if (numOfTransfers < 10) {
    cleanedTransfers = filterSmallAmountsFromCleanedTransfers(cleanedTransfers);
    cleanedTransfers = removeEthWrapsAndUnwraps(cleanedTransfers);
    numOfTransfers = cleanedTransfers.length;
  }

  if (numOfTransfers > 4) return false;

  if (addressIsWhitelisted(to)) return false;

  if (await wasPoolContractCalledDirectly(poolContractAddress, to)) return false;

  if (!(await isCexDexArbCandidateWOdb(from, to, txDetails, numOfTransfers, cleanedTransfers))) return false;

  // if (await isGlobalBackrunForChainFuzzyWOdb(blockNumber, txPosition, from, web3HttpProvider)) return false;

  const abi = await fetchAbiFromEtherscanForChain(to, chain);

  if (abi) return false;

  // If all checks have passed, return true
  return true;
}
