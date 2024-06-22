import { checkMarketsForLendingUser, getRealTimeHealthDataForAllMarketsOfUser, getRecentHealthDataForAllMarketsOfUser, } from './Utils.js';
export const handleUserLendingHealth = (socket) => {
    let intervalId = null; // Track the interval ID for cleanup
    const emitHealthData = async (userAddress) => {
        try {
            const marketsForLendingUser = await checkMarketsForLendingUser('ethereum', userAddress, 1, 50);
            if (marketsForLendingUser) {
                const healthData = await getRecentHealthDataForAllMarketsOfUser(marketsForLendingUser);
                if (healthData) {
                    socket.emit('UserHealthData', healthData);
                }
            }
        }
        catch (error) {
            console.error('Error fetching health data:', error);
            socket.emit('error', 'Failed to fetch health data');
        }
    };
    const setupDisconnectHandler = (userAddress) => {
        // Clear any existing disconnect handler to avoid duplicates
        socket.removeAllListeners('disconnect');
        // Set up a new disconnect handler
        socket.on('disconnect', () => {
            if (intervalId)
                clearInterval(intervalId); // Clear the interval if it has been set
            console.log(`Client disconnected from User-Health-Lending for: ${userAddress}`);
        });
    };
    socket.on('subscribeToUserHealthLendingStream', async (userAddress) => {
        const marketsForLendingUser = await checkMarketsForLendingUser('ethereum', userAddress, 1, 50);
        await emitHealthData(userAddress);
        // Clear any existing interval to prevent duplicates
        if (intervalId)
            clearInterval(intervalId);
        intervalId = setInterval(async () => {
            const realTimeData = await getRealTimeHealthDataForAllMarketsOfUser(marketsForLendingUser);
            if (realTimeData)
                socket.emit('RealTimeHealthUpdate', realTimeData);
        }, 12000);
        setupDisconnectHandler(userAddress);
    });
};
//# sourceMappingURL=Health.js.map