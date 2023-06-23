import { Server } from "socket.io";
import { getLabelsRankingDecendingAbsOccurences } from "./queries/query_sandwiches.js";
export const initServer = (port = process.env.PORT || 3000) => {
    const io = new Server(3000, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.use((socket, next) => {
        const apiKey = socket.handshake.headers["x-api-key"];
        if (apiKey === "your_secret_api_key") {
            next();
        }
        else {
            next(new Error("Authentication error"));
        }
    });
    io.on("connection", (socket) => {
        console.log("Client connected.");
        socket.emit("message", "Hi there!");
        socket.on("runPingPongUpdate", () => {
            setInterval(() => {
                socket.emit("message", "ping");
                setTimeout(() => socket.emit("message", "pong"), 500);
            }, 1000);
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
    console.log(`Server started on port 3000`);
};
//# sourceMappingURL=Server.js.map