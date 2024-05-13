import { getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration } from '../../queries/AtomicArbs.js';
export const handleAtomicArbBotLeaderBoardByTxCountForPoolAndDuration = (socket) => {
    socket.on('getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration', async (poolAddress, timeDuration) => {
        try {
            const AtomicArbBotLeaderBoardByTxCountForPoolAndDuration = await getAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(poolAddress, timeDuration);
            socket.emit('AtomicArbBotLeaderBoardByTxCountForPoolAndDuration', AtomicArbBotLeaderBoardByTxCountForPoolAndDuration);
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=AtomicArbLeaderboardPoolSpecifcByTxCount.js.map