import fs from "fs";
import _ from "lodash";
import path from "path";
import { updateConsoleOutput } from "../helperFunctions/QualityOfLifeStuff.js";
import { findUniqueSourceOfLossAddresses } from "./readFunctions/Sandwiches.js";
import { findUniqueLabeledAddresses } from "./readFunctions/Labels.js";
import { Labels } from "../../models/Labels.js";
/**
 * Function to retrieve addresses that are not yet labeled
 * @returns {Promise<Array<string>>} Array of unlabeled addresses
 */
async function getUnlabeledAddresses() {
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
/**
 * Function to update labels in the database
 */
export async function updateLabels() {
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
            const labelInfo = labelsFromFile.find((label) => label.Address.toLowerCase() === unlabeledAddress.toLowerCase());
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
    updateConsoleOutput(`[✓] Labels synced successfully.`);
}
//# sourceMappingURL=Labels.js.map