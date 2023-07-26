import fs from "fs";
import _, { add } from "lodash";
import path from "path";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { findUniqueSourceOfLossAddresses } from "./readFunctions/Sandwiches.js";
import { findUniqueLabeledAddresses, findVyperContractAddresses } from "./readFunctions/Labels.js";
import { Labels } from "../../models/Labels.js";
import { fetchAbiFromEtherscan } from "./Abi.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { web3Call } from "../web3Calls/generic.js";
import { manualLaborLabels } from "../api/utils/PoolNamesManualLabor.js";

/**
 * Function to retrieve addresses that are not yet labeled
 * @returns {Promise<Array<string>>} Array of unlabeled addresses
 */
async function getUnlabeledAddresses(): Promise<Array<string>> {
  // Fetch all unique addresses from the source of loss
  let uniqueSourceOfLossAddresses = await findUniqueSourceOfLossAddresses();

  // Fetch all addresses that are already labeled
  let uniqueLabeledAddresses = await findUniqueLabeledAddresses();

  // Normalize addresses to lowercase for a case-insensitive comparison and filter out any null or undefined values
  uniqueSourceOfLossAddresses = uniqueSourceOfLossAddresses.filter(Boolean).map((address) => address.toLowerCase());
  uniqueLabeledAddresses = uniqueLabeledAddresses.filter(Boolean).map((address) => address.toLowerCase());

  // Get the difference between the two arrays to find unlabeled addresses
  const unlabeledAddresses = _.difference(uniqueSourceOfLossAddresses, uniqueLabeledAddresses);

  return unlabeledAddresses;
}

async function vyper_contract() {
  let vyperContractAddresses = await findVyperContractAddresses();
  const web3 = await getWeb3HttpProvider();

  for (const address of vyperContractAddresses) {
    // Delay each loop iteration by 200ms
    await new Promise((resolve) => setTimeout(resolve, 200));

    const abi = await fetchAbiFromEtherscan(address);
    let contract = new web3.eth.Contract(abi, address);

    // Check if the ABI has a "name" function
    const hasNameFunction = abi.some((item: any) => item.name === "name" && item.type === "function");

    if (hasNameFunction) {
      try {
        let name = await web3Call(contract, "name", []);
        console.log(name);

        // Update label in the Labels table for the given address
        await Labels.update({ label: name }, { where: { address: address } });
      } catch (err) {
        console.log("err in vyper_contract", err);
      }
    } else {
      // Plan B: Use manual label if it exists
      if (manualLaborLabels[address]) {
        const label = manualLaborLabels[address];

        // Update label in the Labels table for the given address
        await Labels.update({ label: label }, { where: { address: address } });
      }
    }
  }
}

async function fetchAllAddresses(): Promise<string[]> {
  try {
    const labels = await Labels.findAll();
    return labels.map((label) => label.getDataValue("address"));
  } catch (error) {
    console.error(`Error in fetchAllAddresses: ${error}`);
    return [];
  }
}

async function addCustomLabels() {
  // Fetch all records from the Labels table
  const existingLabels = await Labels.findAll();

  const labelsMap = new Map();
  existingLabels.forEach((labelRecord) => {
    // Convert address to lower case for case insensitive comparison
    const lowerCaseAddress = labelRecord.address.toLowerCase();
    labelsMap.set(lowerCaseAddress, labelRecord);
  });

  for (const [address, label] of Object.entries(manualLaborLabels)) {
    // Convert address to lower case
    const lowerCaseAddress = address.toLowerCase();

    if (!labelsMap.has(lowerCaseAddress)) {
      // Add new entry to the Labels table for the given address
      await Labels.create({ address: address, label: label });
    } else {
      // If the label differs, update it
      const existingLabelRecord = labelsMap.get(lowerCaseAddress);
      if (existingLabelRecord.label !== label) {
        existingLabelRecord.label = label;
        await existingLabelRecord.save();
      }
    }
  }
}

/**
 * Function to update labels in the database
 */
export async function updateLabels(): Promise<void> {
  // Fetch addresses that need to be labeled
  const inTableUnlabeledAddresses = await getUnlabeledAddresses();

  // Read the labels from the file
  const possibleDirs = [process.cwd(), path.join(process.cwd(), "..")];
  let labelsFilePath;

  for (const dir of possibleDirs) {
    const tryPath = path.join(dir, "Labels.json");
    if (fs.existsSync(tryPath)) {
      labelsFilePath = tryPath;
      break;
    }
  }

  if (!labelsFilePath) {
    console.error("Labels.json file not found");
    process.exit(1);
  }

  const labelsFromFile = JSON.parse(fs.readFileSync(labelsFilePath, "utf8"));

  // Iterate over the unlabeled addresses
  for (const unlabeledAddress of inTableUnlabeledAddresses) {
    // Check if the unlabeledAddress is not null
    if (unlabeledAddress) {
      // Look for the unlabeled address in the labels file
      const labelInfo = labelsFromFile.find((label: { Address: string }) => label.Address.toLowerCase() === unlabeledAddress.toLowerCase());

      // If the unlabeled address is found in the labels file, save it to the database
      if (labelInfo) {
        const label = new Labels({
          address: labelInfo.Address,
          label: labelInfo.Label,
        });
        await label.save();
      }
    }
  }

  await vyper_contract();
  await addCustomLabels();

  updateConsoleOutput(`[✓] Labels synced successfully.`);
}
