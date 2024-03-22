import axios from "axios";
import { default as PQueue } from "p-queue";
// Function to perform the GraphQL query
async function fetchGraphQLData(query) {
    const url = "https://api.thegraph.com/subgraphs/name/rebase-agency/ethereum-blocks";
    try {
        const response = await axios.post(url, { query });
        return response.data;
    }
    catch (error) {
        if (error instanceof Error)
            console.log("Error message:", error.message);
        throw error;
    }
}
// Function to get the result using the specified query
export async function getBlockTimestamps(blockNumbers) {
    const queue = new PQueue({ concurrency: 4 }); // Adjust based on what the server can handle
    const BATCH_SIZE = 100;
    let blocks = [];
    for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
        // Get a batch of block numbers
        const batch = blockNumbers.slice(i, i + BATCH_SIZE);
        // Convert the block numbers to strings and format them for inclusion in the GraphQL query
        const blockNumberStrings = batch.map((number) => `"${number}"`);
        const blockNumbersQuery = `[${blockNumberStrings.join(", ")}]`;
        const query = `{
      blocks(where: { number_in: ${blockNumbersQuery} }) {
        number
        timestamp
      }
    }`;
        queue.add(async () => {
            const result = await fetchGraphQLData(query);
            blocks = blocks.concat(result.data.blocks);
        });
    }
    await queue.onIdle();
    return blocks;
}
//# sourceMappingURL=Blocktimestamps.js.map