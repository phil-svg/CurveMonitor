import { Socket } from 'socket.io';
import { getCexDexArbBotLeaderBoardbyTxCountForPoolAndDuration } from '../../queries/CexDexArbs.js';

export const handleCexDexArbBotLeaderBoardByTxCountForPoolAndDuration = (socket: Socket) => {
  socket.on(
    'getCexDexArbBotLeaderBoardByTxCountForPoolAndDuration',
    async (poolAddress: string, timeDuration: string) => {
      try {
        const CexDexArbBotLeaderBoardByTxCountForPoolAndDuration =
          await getCexDexArbBotLeaderBoardbyTxCountForPoolAndDuration(poolAddress, timeDuration);
        socket.emit(
          'CexDexArbBotLeaderBoardByTxCountForPoolAndDuration',
          CexDexArbBotLeaderBoardByTxCountForPoolAndDuration
        );
      } catch (error) {
        console.error(error);
        socket.emit('error', 'Internal Server Error');
      }
    }
  );
};
