import { Server, Socket } from "socket.io";
import eventEmitter from "../../goingLive/EventEmitter.js";

export function startAllTxDemoRoom(io: Server): void {
  const allTxDemoRoom = io.of("/allTxDemoRoom");

  allTxDemoRoom.on("connection", (socket: Socket) => {
    console.log("Client connected to allTxDemoRoom.");
    socket.join("allTxDemoRoom");
  });

  eventEmitter.on("new tx for demo room", (data: any) => {
    allTxDemoRoom.in("allTxDemoRoom").emit("DemoNewTx", data);
  });
}
