import { io } from "socket.io-client";
export function startTestClient() {
    const socket = io("http://localhost:433", {
        extraHeaders: {
            "X-API-KEY": "your_secret_api_key",
        },
    });
    socket.on("connect", () => {
        console.log("Connected to the server.");
        // request for ws-connection test
        socket.emit("runSequenceUpdate");
        // request for labels ranking
        // socket.emit("getLabelsRanking");
        socket.on("message", (msg) => {
            console.log("Server said: " + msg);
        });
        socket.on("labelsRanking", (labelsRanking) => {
            console.log("Received labels ranking: ", labelsRanking);
        });
        socket.emit("message", "Hello from the client!");
    });
}
//# sourceMappingURL=Client.js.map