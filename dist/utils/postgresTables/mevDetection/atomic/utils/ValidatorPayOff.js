import Web3 from "web3";
const web3 = new Web3(new Web3.providers.HttpProvider("YOUR_WEB3_PROVIDER_URL"));
// 1. Get the transaction count of a given block number.
async function getTxCountOfBlock(blockNumber) {
    return await web3.eth.getBlockTransactionCount(blockNumber);
}
// 2. Get the Ether transfer value of the last transaction in a block.
async function getLastTxValue(blockNumber) {
    const transactions = await web3.eth.getBlock(blockNumber);
    if (transactions && transactions.transactions.length > 0) {
        const lastTxHash = transactions.transactions[transactions.transactions.length - 1];
        const txDetails = await web3.eth.getTransaction(lastTxHash);
        return parseInt(txDetails.value) / 1e9;
    }
    return 0;
}
export async function getValidatorPayOff(blockNumber) {
    const txCount = await getTxCountOfBlock(blockNumber);
    const lastTxValue = await getLastTxValue(blockNumber);
    return lastTxValue;
}
//# sourceMappingURL=ValidatorPayOff.js.map