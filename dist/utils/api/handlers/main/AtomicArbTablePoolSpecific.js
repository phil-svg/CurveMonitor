import { getPoolSpecificAtomicArbTable } from '../../queries/AtomicArbs.js';
export const handlePoolSpecificAtomicArbRoom = (socket) => {
    socket.on('getPoolSpecificAtomicArbTable', async (poolAddress, timeDuration, page) => {
        try {
            const { data, totalNumberOfAtomicArbs } = await getPoolSpecificAtomicArbTable(poolAddress, timeDuration, page);
            socket.emit('poolSpecificAtomicArbTableContent', { data, totalNumberOfAtomicArbs });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=AtomicArbTablePoolSpecific.js.map