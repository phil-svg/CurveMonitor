export function startPingPongRoom(io) {
    // Function for Ping-Pong functionality
    const handlePingPong = (socket) => {
        socket.on("Ping", () => {
            socket.emit("Pong");
        });
    };
    const pingRoom = io.of("/ping");
    pingRoom.on("connection", (socket) => {
        console.log("Client connected to ping room.");
        handlePingPong(socket);
    });
}
//# sourceMappingURL=ping.js.map