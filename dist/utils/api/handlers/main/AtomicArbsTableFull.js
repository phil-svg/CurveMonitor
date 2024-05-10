import { getFullAtomicArbTable } from '../../queries/AtomicArbs.js';
export const handleFullAtomicArbRoom = (socket) => {
    socket.on('getFullAtomicArbTableContent', async (timeDuration, page) => {
        try {
            const { data, totalNumberOfAtomicArbs } = await getFullAtomicArbTable(timeDuration, page);
            socket.emit('fullAtomicArbTableContent', { data, totalNumberOfAtomicArbs });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=AtomicArbsTableFull.js.map