import { main } from "../../App.js";
import { WEB3_WS_PROVIDER } from "../web3Calls/generic.js";
export async function checkWsConnectionViaNewBlocks() {
    const BLOCK_INTERVAL_TIMEOUT_MS = 30000; // 30 seconds to wait for a new block
    let blockTimeout; // Define a timeout variable to track the 30-second interval
    // Function to reset/start the 30-second block watch timeout
    const resetBlockTimeout = () => {
        // Clear the existing timeout
        if (blockTimeout)
            clearTimeout(blockTimeout);
        // Set a new timeout
        blockTimeout = setTimeout(async () => {
            console.log(`No new blocks in the last ${Math.round(BLOCK_INTERVAL_TIMEOUT_MS / 1000)} seconds`);
            await main();
        }, BLOCK_INTERVAL_TIMEOUT_MS);
    };
    try {
        resetBlockTimeout();
        // Subscribe to new block headers
        WEB3_WS_PROVIDER.eth
            .subscribe("newBlockHeaders", async (error, blockHeader) => {
            if (error) {
                console.error(`Error subscribing to new block headers: ${error}`);
                return;
            }
            // Resetting the 30-second timeout each time a new block is received
            resetBlockTimeout();
            if (blockHeader.number !== null) {
                console.log("New block number:", blockHeader.number);
            }
        })
            .on("error", console.error);
    }
    catch (err) {
        console.error(`An error occurred in subscribeToNewBlocks: ${err.message}`);
    }
}
//# sourceMappingURL=WebsocketConnectionCheck.js.map