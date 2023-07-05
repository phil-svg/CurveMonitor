// Function for Ping-Pong functionality
export const handlePingPong = (socket) => {
    socket.on("Ping", () => {
        socket.emit("Pong");
    });
};
//# sourceMappingURL=Ping.js.map