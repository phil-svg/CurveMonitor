import axios from "axios";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import Web3 from "web3";
if (!process.env.WEB3_WSS) {
    console.error("Error: WEB3_WSS environment variable is not defined.");
    process.exit(1);
}
export async function checkInternetConnection() {
    try {
        await axios.get("http://www.google.com", { timeout: 5000 });
        console.log("Internet connection is available");
        return true;
    }
    catch (error) {
        if (error.code === "ECONNABORTED") {
            console.log("Internet connection check timed out");
        }
        else {
            console.log("No internet connection");
        }
        return false;
    }
}
export async function waitMax2MinutesForInternetToComeBack() {
    console.log("Waiting for internet connection to be restored...");
    let isConnected = false;
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes with a 5-second interval check
    while (!isConnected && attempts < maxAttempts) {
        isConnected = await checkInternetConnection();
        if (!isConnected) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds before the next check
        }
    }
    if (isConnected) {
        console.log("Internet connection restored.");
    }
    else {
        console.log("Internet connection not restored after 2 minutes.");
    }
    return isConnected;
}
export async function checkWeb3WSSConnection() {
    const WEB3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS));
    try {
        const latestBlockNumber = await WEB3.eth.getBlockNumber();
        console.log(`Current block number is: ${latestBlockNumber}`);
        return true;
    }
    catch (error) {
        console.error(`Web3 connection check failed: ${error}`);
        return false;
    }
}
export async function waitMax2MinutesForWeb3WSSProviderToComeBack() {
    console.log("Waiting for Web3 WSS provider to be restored...");
    let isConnected = false;
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes with a 5-second interval check
    while (!isConnected && attempts < maxAttempts) {
        isConnected = await checkWeb3WSSConnection();
        if (!isConnected) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds before the next check
        }
    }
    if (isConnected) {
        console.log("Web3 WSS provider connection restored.");
    }
    else {
        console.log("Web3 WSS provider connection not restored after 2 minutes.");
    }
    return isConnected;
}
//# sourceMappingURL=InternetConnection.js.map