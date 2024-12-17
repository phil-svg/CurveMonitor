import { ABI_TRANSFER } from '../helperFunctions/Erc20Abis.js';
import { getWeb3HttpProvider, getWeb3WsProvider } from '../helperFunctions/Web3.js';
import { getPastEvents } from './generic.js';
export async function runSpeedTest() {
    // await testEthBlockFetchSpeedThrottled();
    // await testEventFetchSpeedHighDensity();
    await testEventFetchSpeedLowDensitiy();
    // await testBlockWithAllReceiptsFetchSpeedThrottled();
    // await newBlockSub();
}
async function testEthBlockFetchSpeedThrottled() {
    const web3 = await getWeb3HttpProvider();
    let count = 0; // Counter for successful block number fetches
    const maxRequestsPerSecond = 100;
    const requestInterval = 1000 / maxRequestsPerSecond; // Calculate the interval in ms
    const duration = 10000; // Total duration of the test in ms
    const endTime = Date.now() + duration;
    // Function to fetch block number
    const fetchBlockNumber = async () => {
        try {
            const blockNumber = await web3.eth.getBlockNumber();
            count++;
            if (count % 25 === 0)
                console.log(`${count} ${blockNumber}`);
        }
        catch (error) {
            console.error('Error fetching block number:', error);
        }
    };
    // Start sending requests at the defined rate
    const start = async () => {
        while (Date.now() < endTime) {
            await new Promise((resolve) => setTimeout(resolve, requestInterval)); // Throttle requests
            fetchBlockNumber();
        }
    };
    // Run the start function
    await start();
    // After the loop, give some time for the last set of requests to complete
    setTimeout(() => {
        console.log(`Total successful fetches in 10 seconds: ${count}`);
    }, 2000); // Assuming a network delay, adjust accordingly
}
async function testEventFetchSpeedHighDensity() {
    const abi = ABI_TRANSFER;
    const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const web3 = await getWeb3HttpProvider();
    const contract = new web3.eth.Contract(abi, address);
    const toBlock = 20362891;
    const fromBlock = toBlock - 1800;
    let count = 1; // Counter for successful event fetches
    console.time('EventFetchSpeedTest');
    let events = await getPastEvents(contract, 'AllEvents', fromBlock, toBlock);
    // console.log('events', events);
    if (Array.isArray(events)) {
        console.log(`Fetch #${count}: ${events.length} events`);
        count++;
    }
    console.timeEnd('EventFetchSpeedTest');
}
async function testEventFetchSpeedLowDensitiy() {
    const abi = ABI_TRANSFER;
    const address = '0x68749665FF8D2d112Fa859AA293F07A622782F38';
    const web3 = await getWeb3HttpProvider();
    const contract = new web3.eth.Contract(abi, address);
    const toBlock = 20362891;
    const fromBlock = toBlock - 250000 * 1;
    let count = 1; // Counter for successful event fetches
    console.time('EventFetchSpeedTest');
    let events = await getPastEvents(contract, 'AllEvents', fromBlock, toBlock);
    // console.log('events', events);
    if (Array.isArray(events)) {
        console.log(`Fetch #${count}: ${events.length} events`);
        count++;
    }
    console.timeEnd('EventFetchSpeedTest');
}
async function testBlockWithAllReceiptsFetchSpeedThrottled() {
    const web3 = await getWeb3HttpProvider();
    let count = 0; // Counter for successful operations
    // const maxRequestsPerSecond = 1000;
    const maxRequestsPerSecond = 1; // Throttle to 1 request per second
    const requestInterval = 10 / maxRequestsPerSecond;
    const duration = 10000; // Test duration in milliseconds
    const endTime = Date.now() + duration;
    // Function to fetch block and all transaction receipts within that block
    const fetchBlockAndReceipts = async () => {
        try {
            const block = await web3.eth.getBlock(20403288, true); // Fetch the block with all transactions
            if (block && block.transactions.length) {
                const receipts = await Promise.all(block.transactions.map((tx) => web3.eth.getTransactionReceipt(tx.hash)));
                console.log(`Block ${block.number} - Receipts fetched: ${receipts.length}`);
            }
            else {
                console.log(`Block ${block.number} - No transactions found`);
            }
            count++;
        }
        catch (error) {
            console.error('Error fetching block and transaction receipts:', error);
        }
    };
    // Start sending requests at the defined rate
    const start = async () => {
        while (Date.now() < endTime) {
            await new Promise((resolve) => setTimeout(resolve, requestInterval));
            fetchBlockAndReceipts();
        }
    };
    await start();
    setTimeout(() => {
        console.log(`Total successful fetches in 10 seconds: ${count}`);
        process.exit();
    }, 2000); // Allow some time for the last requests to complete
}
async function newBlockSub() {
    const web3 = getWeb3WsProvider();
    const subscription = web3.eth.subscribe('newBlockHeaders', async (err, blockHeader) => {
        if (blockHeader.number) {
            console.log('blockHeader.number', blockHeader.number);
        }
        else {
            console.log('missing blocknumber', blockHeader.number);
        }
    });
}
//# sourceMappingURL=SpeedTests.js.map