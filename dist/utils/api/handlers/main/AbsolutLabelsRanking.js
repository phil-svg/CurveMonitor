import { getLabelsRankingDescendingAbsOccurrences } from '../../queries/query_sandwiches.js';
export const handleAbsolutLabelsRankingRoom = (socket) => {
    socket.on('getAbsoluteLabelsRanking', async () => {
        try {
            const labelsRanking = await getLabelsRankingDescendingAbsOccurrences();
            socket.emit('labelsRanking', labelsRanking);
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=AbsolutLabelsRanking.js.map