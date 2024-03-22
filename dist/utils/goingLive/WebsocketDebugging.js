import Web3 from "web3";
import { getContractByAddressWithWebsocket, getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { getAddressesByPoolIds, getAllPoolIds, getIdByAddress } from "../postgresTables/readFunctions/Pools.js";
import { WEB3_WS_PROVIDER, bootWsProvider } from "../web3Calls/generic.js";
import EventEmitter from "./EventEmitter.js";
// buffers events, and processes them in block-chunks (waits for block to be done before parsing.)
async function subscribeToAddress(address) {
    const contract = await getContractByAddressWithWebsocket(address);
    const poolId = await getIdByAddress(address);
    if (!contract)
        return;
    if (!poolId)
        return;
    const subscription = contract.events
        .allEvents({ fromBlock: "latest" })
        .on("data", async (event) => {
        console.log(`New Event spotted: ${event.transactionHash}`);
    })
        .on("error", (error) => {
        console.log(`Subscription error: ${error}`);
    });
    // .on("connected", (subscriptionId: string) => {
    //   console.log("connected");
    //   // console.log(`Subscription connected with id: ${subscriptionId}`);
    //   activeSubscriptions[address] = subscription; // store subscription object
    // });
    // storing the subscription object for later unsubscription
    // activeSubscriptions[address] = subscription;
}
// async function processUnsubscribe(address: string) {
//   return new Promise<void>((resolve) => {
//     const subscription = activeSubscriptions[address];
//     if (subscription.unsubscribe) {
//       subscription.unsubscribe((error, success) => {
//         if (error) {
//           console.error(`Error unsubscribing from ${address}:`, error);
//         } else {
//           console.log(`Unsubscribed successfully from ${address}`);
//         }
//         // Resolve the promise after a delay, regardless of unsubscribe success
//         setTimeout(resolve, 50); // Delay to prevent hitting rate limits
//       });
//     } else {
//       resolve(); // Immediately resolve if there's no unsubscribe function
//     }
//   });
// }
async function closeWebSocketConnection() {
    console.log("running close WebSocket Connection");
    // Iterate over activeSubscriptions and call unsubscribe for each
    // Object.keys(activeSubscriptions).forEach(async (address) => {
    //   const subscription = activeSubscriptions[address];
    //   if (subscription.unsubscribe) {
    //     subscription.unsubscribe(async (error, success) => {
    //       if (error) {
    //         console.error(`Error unsubscribing from ${address}:`, error);
    //       } else {
    //         console.log(`Unsubscribed successfully from ${address}`);
    //       }
    //       await new Promise((resolve) => setTimeout(resolve, 50));
    //     });
    //   }
    // });
    // console.log("hello");
    // for (const address of Object.keys(activeSubscriptions)) {
    //   await processUnsubscribe(address); // Wait for each unsubscribe to complete before continuing
    // }
    const web3 = getWeb3WsProvider();
    if (web3.currentProvider && web3.currentProvider instanceof Web3.providers.WebsocketProvider) {
        try {
            // Close the WebSocket connection
            web3.currentProvider.disconnect(1000, "Closing connection due to inactivity or manual restart.");
            console.log("WebSocket connection closed successfully.");
        }
        catch (error) {
            console.error("Failed to close WebSocket connection:", error);
        }
    }
    else {
        console.log("Current provider is not a WebSocket provider or the connection is already closed.");
    }
    // Now it's safe to clear activeSubscriptions as all have been properly unsubscribed
    // activeSubscriptions = {};
}
async function restart() {
    console.time();
    await closeWebSocketConnection(); // 50 seconds for 280 disconnects.
    console.timeEnd();
    await subToAll();
}
async function subToAll() {
    const poolIdsFull = await getAllPoolIds();
    const poolAddresses = await getAddressesByPoolIds(poolIdsFull);
    let counter = 0;
    for (const poolAddress of poolAddresses) {
        counter++;
        // console.log(counter, "/", poolAddresses.length);
        const numPools = 900;
        if (counter > numPools)
            continue;
        if (counter === numPools) {
            console.log(counter, "/", numPools);
        }
        else if (counter % 100 === 0) {
            console.log(counter, "/", numPools);
        }
        await subscribeToAddress(poolAddress);
        // console.log("activeSubscriptions", activeSubscriptions);
        // const count = Object.keys(activeSubscriptions).length;
        // console.log(`There are ${count} active subscriptions.`);
        // if (count === 4) process.exit();
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
let blockTimeout; // Define a timeout variable to track the 30-second interval
let subscription; // Holds the subscription object
let keepWatching = true; // Control flag
async function checkWsConnectionViaNewBlocksOld() {
    clearTimeout(blockTimeout); // Clear any existing timeout to avoid duplicates
    const BLOCK_INTERVAL_TIMEOUT_MS = 30000; // 30 seconds
    const resetBlockTimeout = () => {
        if (blockTimeout)
            clearTimeout(blockTimeout); // Clear the existing timeout
        if (!keepWatching)
            return; // Exit if we're no longer supposed to keep watching
        blockTimeout = setTimeout(async () => {
            console.log(`No new blocks in the last ${Math.round(BLOCK_INTERVAL_TIMEOUT_MS / 1000)} seconds`);
            // Here, you might want to "kill the loop"
            keepWatching = false; // Stop the process
            if (subscription) {
                subscription.unsubscribe(); // Unsubscribe to stop receiving new block headers
            }
            clearTimeout(blockTimeout); // Ensure no further timeouts are set
            // Optionally, invoke any cleanup or restart logic here
            // await restartAndReSubscribe(); // Commented out, assuming you want to stop the process entirely
        }, BLOCK_INTERVAL_TIMEOUT_MS);
    };
    try {
        resetBlockTimeout();
        subscription = WEB3_WS_PROVIDER.eth
            .subscribe("newBlockHeaders", async (error, blockHeader) => {
            if (error) {
                console.error(`Error subscribing to new block headers: ${error}`);
                return;
            }
            // Ensure we reset the timeout only if we're continuing the watch
            if (keepWatching) {
                resetBlockTimeout();
            }
            if (blockHeader.number !== null) {
                console.log("New block", blockHeader.number);
            }
        })
            .on("error", console.error);
    }
    catch (err) {
        console.error(`An error occurred in subscribeToNewBlocks: ${err}`);
    }
}
async function checkWsConnectionViaNewBlocks() {
    let lastSavedBlockNumber = 0;
    let lastReveivedBlockNumber = 0;
    subscription = WEB3_WS_PROVIDER.eth.subscribe("newBlockHeaders", async (err, blockHeader) => {
        lastReveivedBlockNumber = blockHeader.number;
        // console.log("New block", blockHeader.number);
    });
    await new Promise((resolve) => setTimeout(resolve, 20000));
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // never triggered, could work, could not work.
        // await new Promise((resolve) => setTimeout(resolve, 5000));
        // console.log("lastSavedBlockNumber", lastSavedBlockNumber);
        // console.log("lastReveivedBlockNumber", lastReveivedBlockNumber);
        if (lastSavedBlockNumber === lastReveivedBlockNumber)
            break;
        lastSavedBlockNumber = lastReveivedBlockNumber;
    }
    EventEmitter.emit("dead websocket connection");
    return;
}
function setupDeadWebsocketListener() {
    EventEmitter.on("dead websocket connection", async () => {
        console.log("Dead WebSocket connection detected, restarting main function...");
        await main();
    });
}
// Function to manually stop watching for new blocks
function stopWatching() {
    keepWatching = false; // Update control flag to stop the process
    if (blockTimeout)
        clearTimeout(blockTimeout); // Clear any pending timeout
    if (subscription)
        subscription.unsubscribe(); // Unsubscribe from the new block headers
}
async function eraseWebProvider() {
    // console.log("Trying to erase Web3 Provider!");
    // Disconnect WebSocket Provider
    if (typeof WEB3_WS_PROVIDER !== "undefined" && WEB3_WS_PROVIDER !== null) {
        const wsProvider = WEB3_WS_PROVIDER.currentProvider;
        if (wsProvider && wsProvider instanceof Web3.providers.WebsocketProvider) {
            wsProvider.disconnect(1000, "Manual disconnect");
            console.log("WebSocket Provider disconnected.");
        }
    }
}
async function restartAndReSubscribe() {
    await eraseWebProvider();
    await bootWsProvider();
    await subToAll();
    await checkWsConnectionViaNewBlocks();
}
async function main() {
    await eraseWebProvider();
    await bootWsProvider();
    await subToAll();
    await checkWsConnectionViaNewBlocks();
}
export async function websocketDebugging() {
    // await subToAll();
    // await restart();
    // await restart();
    // await eraseWebProvider(); // cleaning all perhaps existing WS.
    // await bootWsProvider(); // starting new WS connection.
    // await subToAll();
    // await eraseWebProvider(); // cleaning all perhaps existing WS.
    // await bootWsProvider(); // starting new WS connection.
    // await subToAll();
    setupDeadWebsocketListener();
    await main();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await restartAndReSubscribe();
    // await checkWsConnectionViaNewBlocks();
}
//# sourceMappingURL=WebsocketDebugging.js.map