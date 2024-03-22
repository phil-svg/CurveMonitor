import { WEB3_WS_PROVIDER } from "../web3Calls/generic.js";
export async function checkWsConnectionViaNewBlocksOld(startTime = Date.now()) {
    const RETRY_INTERVAL_MS = 10000; // Retry every 10 seconds
    const MAX_RETRY_DURATION_MS = 120000; // Total retry duration of 2 minutes (120 seconds)
    const BLOCK_INTERVAL_TIMEOUT_MS = 30000; // 30 seconds to wait for a new block
    let blockTimeout; // Define a timeout variable to track the 30-second interval
    // Function to reset/start the 30-second block watch timeout
    const resetBlockTimeout = () => {
        // Clear the existing timeout
        if (blockTimeout)
            clearTimeout(blockTimeout);
        // Set a new timeout
        blockTimeout = setTimeout(() => {
            console.log(`No new blocks in the last ${Math.round(BLOCK_INTERVAL_TIMEOUT_MS / 1000)} seconds`);
        }, BLOCK_INTERVAL_TIMEOUT_MS);
    };
    try {
        resetBlockTimeout();
        // Subscribe to new block headers
        WEB3_WS_PROVIDER.eth
            .subscribe("newBlockHeaders", async (error, blockHeader) => {
            if (error) {
                console.error(`Error subscribing to new block headers: ${error}`);
                if (error.message.includes("connection not open")) {
                    const currentTime = Date.now();
                    if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
                        console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
                        setTimeout(() => checkWsConnectionViaNewBlocksOld(startTime), RETRY_INTERVAL_MS);
                    }
                    else {
                        console.error("Failed to subscribe to new block headers after 2 minutes.");
                    }
                }
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
        const currentTime = Date.now();
        if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
            console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
            setTimeout(() => checkWsConnectionViaNewBlocksOld(startTime), RETRY_INTERVAL_MS);
        }
        else {
            console.error("Failed to subscribe to new block headers after 2 minutes.");
        }
    }
}
async function foo() {
    while (true) {
        console.log("spam");
    }
}
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
            await foo();
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
//# sourceMappingURL=WebsocketDebugging.js.map