import { Socket } from 'socket.io';
import { getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration } from '../../queries/AtomicArbs.js';

export const handleAtomicArbBotLeaderBoardByTxCountForPoolAndDuration = (socket: Socket) => {
  socket.on(
    'getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration',
    async (poolAddress: string, timeDuration: string) => {
      try {
        const AtomicArbBotLeaderBoardByTxCountForPoolAndDuration =
          await getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(poolAddress, timeDuration);
        socket.emit(
          'AtomicArbBotLeaderBoardByTxCountForPoolAndDuration',
          AtomicArbBotLeaderBoardByTxCountForPoolAndDuration
        );
      } catch (error) {
        console.error(error);
        socket.emit('error', 'Internal Server Error');
      }
    }
  );
};
