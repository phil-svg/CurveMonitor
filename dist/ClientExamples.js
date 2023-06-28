import { io } from "socket.io-client";
console.clear();
export function startTestClient() {
    // const socket = io("wss://api.curvemonitor.com/allTxDemoRoom", {});
    const socket = io("http://localhost:443/allTxDemoRoom", {});
    socket.on("connect", () => {
        console.log("Connected to the server.");
        // request for labels ranking
        // socket.emit("getLabelsRanking");
        socket.on("labelsRanking", (labelsRanking) => {
            console.log("Received labels ranking: ", labelsRanking);
        });
        socket.on("DemoNewTx", (demoTx) => {
            console.log("Saw new Tx in Demo-Mode: ", demoTx);
        });
        socket.on("message", (msg) => {
            console.log("Server said: " + msg);
        });
        socket.emit("message", "Hello from the client!");
    });
    socket.on("connect_error", (err) => {
        console.log(`Connection Error: ${err}`);
    });
    socket.on("error", (err) => {
        console.log(`Error: ${err}`);
    });
}
startTestClient();
//# sourceMappingURL=ClientExamples.js.map