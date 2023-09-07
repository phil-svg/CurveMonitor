import { ReadableTokenTransfer } from "../../../Interfaces.js";
import { getTransactionTraceFromDb } from "../../readFunctions/TransactionTrace.js";
import { getAllUniqueTransactionHashes } from "../../readFunctions/Transactions.js";
import { getReadableTransfersFromTransactionTrace } from "../../../txMap/TransferCategories.js";
import fs from "fs";

function removeFalsePositiveFlashLoans(detectedFlashLoans: any[], readableTransfers: ReadableTokenTransfer[]): any[] {
  // If no flashloans detected, just return the input array
  if (!detectedFlashLoans.length) {
    return detectedFlashLoans;
  }

  // Iterate over detected flashloans and filter out false positives
  return detectedFlashLoans.filter((flashLoan) => {
    const takenPosition = flashLoan.takenFlashloan.position!;

    // Check both subsequent and preceding positions for back transfers
    const checkPositions = [takenPosition + 1, takenPosition - 1];

    for (const checkPosition of checkPositions) {
      const potentialBackTransfer = readableTransfers.find(
        (transfer) =>
          transfer.position === checkPosition &&
          transfer.from === flashLoan.takenFlashloan.to &&
          transfer.to === flashLoan.takenFlashloan.from &&
          transfer.tokenAddress !== flashLoan.takenFlashloan.tokenAddress
      );

      // If the potentialBackTransfer exists at any check position, it's a false positive
      if (potentialBackTransfer) {
        return false;
      }
    }

    return true;
  });
}

async function findFlashloan_s(readableTransfers: ReadableTokenTransfer[]): Promise<any[]> {
  let flashLoans: any[] = [];
  let earlyFlashloanDetected = false; // This flag is set to true if a flashloan is detected within the first 3 positions

  for (let i = 0; i < readableTransfers.length; i++) {
    const currentTransfer = readableTransfers[i];

    // If we're beyond position 2 and haven't detected an early flashloan, break out of the loop
    if (currentTransfer.position! > 2 && !earlyFlashloanDetected) {
      break;
    }

    if (currentTransfer.tokenSymbol === "ETH") continue; // Skip if the token is ETH

    for (let j = i + 1; j < readableTransfers.length; j++) {
      const subsequentTransfer = readableTransfers[j];

      // Skip subsequent transfers with tokenSymbol as ETH
      if (subsequentTransfer.tokenSymbol === "ETH") continue;

      // Checking if the position gap is at least 2
      if (Math.abs(currentTransfer.position! - subsequentTransfer.position!) < 2) {
        continue;
      }

      if (
        currentTransfer.from === subsequentTransfer.to &&
        currentTransfer.tokenAddress === subsequentTransfer.tokenAddress &&
        currentTransfer.parsedAmount === subsequentTransfer.parsedAmount &&
        currentTransfer.parsedAmount > 0
      ) {
        // Check if flashloan provider (currentTransfer.from) only has received funds from the taker (currentTransfer.to)
        let isValidFlashloanProvider = true;
        for (const transfer of readableTransfers) {
          if (transfer.to === currentTransfer.from && transfer.from !== currentTransfer.to) {
            isValidFlashloanProvider = false;
            break;
          }
        }

        if (!isValidFlashloanProvider) {
          continue;
        }

        // Detected a valid flashloan based on criteria
        const flashloanDetails = {
          takenFlashloan: {
            from: currentTransfer.from,
            to: currentTransfer.to,
            tokenAddress: currentTransfer.tokenAddress,
            tokenSymbol: currentTransfer.tokenSymbol || "Unknown",
            parsedAmount: currentTransfer.parsedAmount,
            position: currentTransfer.position,
          },
          repayedFlashloan: {
            from: subsequentTransfer.from,
            to: subsequentTransfer.to,
            tokenAddress: subsequentTransfer.tokenAddress,
            tokenSymbol: subsequentTransfer.tokenSymbol || "Unknown",
            parsedAmount: subsequentTransfer.parsedAmount,
            position: subsequentTransfer.position,
          },
        };

        flashLoans.push(flashloanDetails);

        // If the position of the current transfer is within the first 3 positions, set the flag
        if (currentTransfer.position! <= 2) {
          earlyFlashloanDetected = true;
        }

        break; // Break the inner loop as we found a match for this transfer
      }
    }
  }

  flashLoans = removeFalsePositiveFlashLoans(flashLoans, readableTransfers);
  return flashLoans;
}

interface FlashloanResult {
  didFlashloan: number;
  didNotFlashloan: number;
  flashloanDetails: any[];
}

async function countFlashloans(txHashes: string[]): Promise<FlashloanResult> {
  let didFlashloanCount = 0;
  let didNotFlashloanCount = 0;
  let allFlashloanDetails: any[] = [];
  const totalTxHashes = txHashes.length;

  for (const [index, txHash] of txHashes.entries()) {
    // if (index >= 1000) continue;
    const transaction_trace = await getTransactionTraceFromDb(txHash);
    const readableTransfers = await getReadableTransfersFromTransactionTrace(transaction_trace);
    const flashloan_s = await findFlashloan_s(readableTransfers);

    if (flashloan_s.length > 0) {
      const augmentedFlashloans = flashloan_s.map((flashloan) => ({
        ...flashloan,
        tx_hash: txHash,
      }));

      allFlashloanDetails = allFlashloanDetails.concat(augmentedFlashloans);

      didFlashloanCount++;
    } else {
      didNotFlashloanCount++;
    }

    // Printing progress:
    if ((index + 1) % 1000 === 0) {
      console.log(`Processed: ${index + 1}/${totalTxHashes}. Flashloans found so far: ${didFlashloanCount}.`);
    }
  }

  return {
    didFlashloan: didFlashloanCount,
    didNotFlashloan: didNotFlashloanCount,
    flashloanDetails: allFlashloanDetails,
  };
}

async function main() {
  const CONIC_HACK = "0x64910b0a07083119403ce1bb30c94503e99e44c334bdb68f3afea09c834bdd9f";

  const pETH_HACK = "0xa84aa065ce61dbb1eb50ab6ae67fc31a9da50dd2c74eefd561661bfce2f1620c";
  const msETH_HACK = "0xc93eb238ff42632525e990119d3edc7775299a70b56e54d83ec4f53736400964";
  const alETH_HACK = "0xb676d789bb8b66a08105c844a49c2bcffb400e5c1cfabd4bc30cca4bff3c9801";

  const allTxHashes = await getAllUniqueTransactionHashes();
  const result = await countFlashloans(allTxHashes);
  fs.writeFileSync("result.json", JSON.stringify(result, null, 2));
  console.log(`Total Transactions with Flashloan: ${result.didFlashloan}`);
  console.log(`Total Transactions without Flashloan: ${result.didNotFlashloan}`);

  // const transaction_trace = await getTransactionTraceFromDb(txHash);

  // const readableTransfers = await getReadableTransfersFromTransactionTrace(transaction_trace);
  // console.dir(readableTransfers, { depth: null, colors: true });

  // const flashloan_s = await findFlashloan_s(readableTransfers);
  // console.log("flashloan_s", flashloan_s);

  // const didFlashloan = flashloan_s.length > 0;
  // console.log("didFlashloan", didFlashloan);
}

interface FlashloanDetail {
  takenFlashloan: {
    tokenAddress: string;
    parsedAmount: number;
  };
  tx_hash: string;
}

interface TokenPrice {
  tokenAddress: string;
  price: number;
}

function calculateFlashloanValues(flashloanDetails: FlashloanDetail[], tokenPrices: TokenPrice[]): { tx_hash: string; value: number }[] {
  // Create a map to store summed values for each tx_hash
  const valueMap: Map<string, number> = new Map();

  flashloanDetails.forEach((detail) => {
    const { tokenAddress, parsedAmount } = detail.takenFlashloan;
    const token = tokenPrices.find((t) => t.tokenAddress === tokenAddress);

    // If token price exists, calculate the value
    if (token) {
      const value = parsedAmount * token.price;

      // If tx_hash already exists in the map, add to its value
      if (valueMap.has(detail.tx_hash)) {
        valueMap.set(detail.tx_hash, valueMap.get(detail.tx_hash)! + value);
      } else {
        // Otherwise, set the tx_hash and its value in the map
        valueMap.set(detail.tx_hash, value);
      }
    }
  });

  // Convert the map to an array and sort it in descending order based on the flashloan value
  const resultArray = Array.from(valueMap.entries()).map(([tx_hash, value]) => ({
    tx_hash,
    value,
  }));

  resultArray.sort((a, b) => b.value - a.value);

  return resultArray;
}

export async function flashLoanDetection() {
  // await main();
}
