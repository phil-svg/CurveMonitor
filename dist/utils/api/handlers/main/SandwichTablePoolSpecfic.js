import { getSandwichTableContentForPool } from '../../queries/query_sandwiches.js';
export const handlePoolSandwichRoom = (socket) => {
    socket.on('getPoolSpecificSandwichTable', async (poolAddress, duration, page) => {
        try {
            const { data, totalSandwiches } = await getSandwichTableContentForPool(poolAddress, duration, page);
            socket.emit('SandwichTableContentForPool', { data, totalSandwiches });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=SandwichTablePoolSpecfic.js.map