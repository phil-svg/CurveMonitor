import { Socket } from 'socket.io';
import { getPoolSpecificCexDexArbTable } from '../../queries/CexDexArbs.js';

export const handlePoolSpecificCexDexArbRoom = (socket: Socket) => {
  socket.on('getPoolSpecificCexDexArbTable', async (poolAddress: string, timeDuration: string, page: number) => {
    try {
      const { data, totalNumberOfCexDexArbs } = await getPoolSpecificCexDexArbTable(poolAddress, timeDuration, page);
      socket.emit('poolSpecificCexDexArbTableContent', { data, totalNumberOfCexDexArbs });
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Internal Server Error');
    }
  });
};
