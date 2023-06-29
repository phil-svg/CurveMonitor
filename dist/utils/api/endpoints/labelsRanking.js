import { getLabelsRankingDecendingAbsOccurences } from "../queries/query_sandwiches.js";
export function startAbsolutLabelsRankingRoom(io) {
    const labelsRankingRoom = io.of("/labelsRanking");
    labelsRankingRoom.on("connection", async (socket) => {
        console.log("Client connected to labelsRanking room.");
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
    });
}
//# sourceMappingURL=labelsRanking.js.map