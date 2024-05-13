import { getCexDexArbBotLeaderBoardbyTxCountForPoolAndDuration } from '../../queries/CexDexArbs.js';
export const handleCexDexArbBotLeaderBoardByTxCountForPoolAndDuration = (socket) => {
    socket.on('getCexDexArbBotLeaderBoardByTxCountForPoolAndDuration', async (poolAddress, timeDuration) => {
        try {
            const CexDexArbBotLeaderBoardByTxCountForPoolAndDuration = await getCexDexArbBotLeaderBoardbyTxCountForPoolAndDuration(poolAddress, timeDuration);
            socket.emit('CexDexArbBotLeaderBoardByTxCountForPoolAndDuration', CexDexArbBotLeaderBoardByTxCountForPoolAndDuration);
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=CexDexArbLeaderboardPoolSpecificByTxCount.js.map