import { Socket } from 'socket.io';
import { getFullAtomicArbTable } from '../../queries/AtomicArbs.js';

export const handleFullAtomicArbRoom = (socket: Socket) => {
  socket.on('getFullAtomicArbTableContent', async (timeDuration: string, page: number) => {
    try {
      const { data, totalNumberOfAtomicArbs } = await getFullAtomicArbTable(timeDuration, page);
      socket.emit('fullAtomicArbTableContent', { data, totalNumberOfAtomicArbs });
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Internal Server Error');
    }
  });
};
