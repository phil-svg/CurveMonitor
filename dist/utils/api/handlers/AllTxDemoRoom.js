import eventEmitter from "../../goingLive/EventEmitter.js";
export function handleAllTxDemoRoom(io) {
    const allTxDemoRoom = io.of("/allTxDemoRoom");
    allTxDemoRoom.on("connection", (socket) => {
        console.log("Client connected to allTxDemoRoom.");
        socket.join("allTxDemoRoom");
    });
    eventEmitter.on("new tx for demo room", (data) => {
        allTxDemoRoom.in("allTxDemoRoom").emit("DemoNewTx", data);
    });
}
//# sourceMappingURL=AllTxDemoRoom.js.map