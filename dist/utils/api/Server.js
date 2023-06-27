import { Server } from "socket.io";
import { getLabelsRankingDecendingAbsOccurences } from "./queries/query_sandwiches.js";
export const initServer = () => {
    const io = new Server(443, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.on("connection", (socket) => {
        console.log("Client connected.");
        socket.emit("message", "Hi there!");
        socket.on("runSequenceUpdate", () => {
            const sequence = ["It", "works", "even", "better", "than", "before!"];
            let index = 0;
            const interval = setInterval(() => {
                socket.emit("sequenceUpdate", sequence[index]);
                index++;
                if (index >= sequence.length) {
                    clearInterval(interval);
                }
            }, 300);
        });
        socket.on("getLabelsRanking", async () => {
            try {
                const labelsRanking = await getLabelsRankingDecendingAbsOccurences();
                socket.emit("labelsRanking", labelsRanking);
            }
            catch (error) {
                console.error(error);
                socket.emit("error", "Internal Server Error");
            }
        });
        socket.on("message", (msg) => {
            console.log("Client said: " + msg);
        });
    });
    console.log(`Server started on port 433`);
};
//# sourceMappingURL=Server.js.map