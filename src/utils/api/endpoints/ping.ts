import { Server, Socket } from "socket.io";

export function startPingPongRoom(io: Server): void {
  // Function for Ping-Pong functionality
  const handlePingPong = (socket: Socket) => {
    socket.on("Ping", () => {
      socket.emit("Pong");
    });
  };

  const pingRoom = io.of("/ping");
  pingRoom.on("connection", (socket: Socket) => {
    console.log("Client connected to ping room.");
    handlePingPong(socket);
  });
}
