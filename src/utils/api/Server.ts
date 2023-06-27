import { Server } from "socket.io";
import { getLabelsRankingDecendingAbsOccurences } from "./queries/query_sandwiches.js";
import eventEmitter from "../goingLive/EventEmitter.js";

export const initServer = (): void => {
  const io = new Server(443, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const allTxDemoRoom = io.of("/allTxDemoRoom");
  allTxDemoRoom.on("connection", async (socket) => {
    socket.join("allTxDemoRoom");
  });

  eventEmitter.on("new tx for demo room", async (data: any) => {
    allTxDemoRoom.in("allTxDemoRoom").emit("DemoNewTx", data);
  });

  io.on("connection", (socket) => {
    console.log("Client connected.");

    socket.emit("message", "Hi there!");

    socket.on("getLabelsRanking", async () => {
      try {
        const labelsRanking = await getLabelsRankingDecendingAbsOccurences();
        socket.emit("labelsRanking", labelsRanking);
      } catch (error) {
        console.error(error);
        socket.emit("error", "Internal Server Error");
      }
    });

    socket.on("message", (msg) => {
      console.log("Client said: " + msg);
    });
  });

  console.log(`Server started on port 433`);
};
