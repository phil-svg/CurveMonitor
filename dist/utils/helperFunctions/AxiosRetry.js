import axios from "axios";
import axiosRetry from "axios-retry";
axiosRetry(axios, { retries: 3 });
export async function getTxReceipt(txHash) {
    try {
        const response = await axios.post(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`, {
            id: 1,
            jsonrpc: "2.0",
            method: "eth_getTransactionReceipt",
            params: [txHash],
        }, {
            timeout: 5000, // Set a timeout of 5000 milliseconds
        });
        if (response.data && response.data.result) {
            return response.data.result;
        }
        else {
            console.log(response);
            return null;
        }
    }
    catch (error) {
        console.log(error);
        return null;
    }
}
//# sourceMappingURL=AxiosRetry.js.map