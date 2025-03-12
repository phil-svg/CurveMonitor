import axios from 'axios';
import Web3 from 'web3';
export async function checkMarketsForLendingUser(chain, userAddress, page = 1, perPage = 50) {
    const url = `https://prices.curve.fi/v1/lending/users/${chain}/${userAddress}?page=${page}&per_page=${perPage}`;
    try {
        const response = await axios.get(url, {
            headers: {
                accept: 'application/json',
            },
        });
        if (response.status === 200) {
            return response.data;
        }
        else {
            console.error('Failed to fetch data:', response.status);
            return null;
        }
    }
    catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}
export async function getRecentHealthDataForAllMarketsOfUser(marketsForLendingUser) {
    const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET));
    if (marketsForLendingUser.markets.length === 0) {
        return null;
    }
    const allMarketHealthData = [];
    const currentBlock = await web3HttpProvider.eth.getBlockNumber();
    for (const market of marketsForLendingUser.markets) {
        const healthData = await getRecentHealthDataForMarket(marketsForLendingUser.user, market.controller, web3HttpProvider, currentBlock);
        if (healthData.length > 0) {
            allMarketHealthData.push({
                marketName: market.market_name,
                userAddress: marketsForLendingUser.user,
                controllerAddress: market.controller,
                healthDataPoints: healthData,
            });
        }
    }
    return allMarketHealthData;
}
export async function getRecentHealthDataForMarket(userAddress, controllerAddress, web3HttpProvider, currentBlock) {
    const currentBlockTime = Math.floor(Date.now() / 1000);
    let healthData = [];
    // fetching last 5 blocks
    for (let i = 0; i < 5; i++) {
        const blockNumber = currentBlock - i;
        const health = await getUserHealthForMarket(userAddress, controllerAddress, web3HttpProvider, blockNumber);
        if (health !== null) {
            const blockTimeEstimate = currentBlockTime - i * 12; // Assuming each block approximately 12 seconds apart.
            healthData.push({
                timestamp: blockTimeEstimate,
                blockNumber: blockNumber,
                health: health,
            });
        }
    }
    return healthData;
}
async function getUserHealthForMarket(userAddress, controllerAddress, web3HttpProvider, blockNumber) {
    try {
        const ABI_HEALTH = [
            {
                stateMutability: 'view',
                type: 'function',
                name: 'health',
                inputs: [{ name: 'user', type: 'address' }],
                outputs: [{ name: '', type: 'int256' }],
            },
        ];
        const contract = new web3HttpProvider.eth.Contract(ABI_HEALTH, controllerAddress);
        const health = blockNumber
            ? (await contract.methods.health(userAddress).call(blockNumber)) / 1e16
            : (await contract.methods.health(userAddress).call()) / 1e16;
        return health;
    }
    catch (error) {
        return null;
    }
}
export async function getRealTimeHealthDataForAllMarketsOfUser(marketsForLendingUser) {
    const web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET));
    if (marketsForLendingUser.markets.length === 0) {
        return null;
    }
    const allMarketRealTimeHealth = [];
    for (const market of marketsForLendingUser.markets) {
        const health = await getUserHealthForMarket(marketsForLendingUser.user, market.controller, web3HttpProvider);
        if (health !== null) {
            allMarketRealTimeHealth.push({
                marketName: market.market_name,
                userAddress: marketsForLendingUser.user,
                controllerAddress: market.controller,
                health: health,
                timestamp: Math.floor(Date.now() / 1000),
            });
        }
    }
    return allMarketRealTimeHealth;
}
//# sourceMappingURL=Utils.js.map