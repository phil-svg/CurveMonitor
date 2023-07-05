import { getLabelsRankingDecendingAbsOccurences } from "../queries/query_sandwiches.js";
export const handleAbsolutLabelsRankingRoom = (socket) => {
    socket.on("getAbsoluteLabelsRanking", async () => {
        try {
            const labelsRanking = await getLabelsRankingDecendingAbsOccurences();
            socket.emit("labelsRanking", labelsRanking);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=AbsolutLabelsRanking.js.map