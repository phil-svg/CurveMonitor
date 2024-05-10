import { Socket } from 'socket.io';
import { getPoolSpecificAtomicArbTable } from '../../queries/AtomicArbs.js';

export const handlePoolSpecificAtomicArbRoom = (socket: Socket) => {
  socket.on('getPoolSpecificAtomicArbTable', async (poolAddress: string, timeDuration: string, page: number) => {
    try {
      const { data, totalNumberOfAtomicArbs } = await getPoolSpecificAtomicArbTable(poolAddress, timeDuration, page);
      socket.emit('poolSpecificAtomicArbTableContent', { data, totalNumberOfAtomicArbs });
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Internal Server Error');
    }
  });
};
