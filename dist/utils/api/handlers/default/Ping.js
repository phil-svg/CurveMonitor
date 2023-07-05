// Function for Ping-Pong functionality
export const handlePingPong = (socket) => {
    console.log("sfdjhd");
    socket.on("Ping", () => {
        console.log("hihi");
        socket.emit("Pong");
    });
};
//# sourceMappingURL=Ping.js.map