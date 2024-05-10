import { Socket } from 'socket.io';
import { getFullCexDexArbTable } from '../../queries/CexDexArbs.js';

export const handleFullCexDexArbRoom = (socket: Socket) => {
  socket.on('getFullCexDexArbTableContent', async (timeDuration: string, page: number) => {
    try {
      const { data, totalNumberOfCexDexArbs } = await getFullCexDexArbTable(timeDuration, page);
      socket.emit('fullCexDexArbTableContent', { data, totalNumberOfCexDexArbs });
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Internal Server Error');
    }
  });
};
