import { getPoolSpecificCexDexArbTable } from '../../queries/CexDexArbs.js';
export const handlePoolSpecificCexDexArbRoom = (socket) => {
    socket.on('getPoolSpecificCexDexArbTable', async (poolAddress, timeDuration, page) => {
        try {
            const { data, totalNumberOfCexDexArbs } = await getPoolSpecificCexDexArbTable(poolAddress, timeDuration, page);
            socket.emit('poolSpecificCexDexArbTableContent', { data, totalNumberOfCexDexArbs });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=CexDexArbsTablePoolSpecific.js.map