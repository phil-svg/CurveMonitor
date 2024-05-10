import { getFullCexDexArbTable } from '../../queries/CexDexArbs.js';
export const handleFullCexDexArbRoom = (socket) => {
    socket.on('getFullCexDexArbTableContent', async (timeDuration, page) => {
        try {
            const { data, totalNumberOfCexDexArbs } = await getFullCexDexArbTable(timeDuration, page);
            socket.emit('fullCexDexArbTableContent', { data, totalNumberOfCexDexArbs });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=CexDexArbsTableFull.js.map