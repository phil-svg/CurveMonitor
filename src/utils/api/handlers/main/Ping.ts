import { Socket } from "socket.io";

// Function for Ping-Pong functionality
export const handlePingPong = (socket: Socket) => {
  socket.on("Ping", () => {
    socket.emit("Pong");
  });
};
