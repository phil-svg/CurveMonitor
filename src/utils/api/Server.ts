import { Server } from "socket.io";
import { startPingPongRoom } from "./endpoints/ping.js";
import { startAllTxDemoRoom } from "./endpoints/allTxDemoRoom.js";
import { startAbsolutLabelsRankingRoom } from "./endpoints/absolutLabelsRanking.js";
import { startSandwichLabelOccurrencesRoom } from "./endpoints/relativeLabelsRaking.js";

const port = 443;

export const startAPI = (): void => {
  const io = new Server(port, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  startPingPongRoom(io);
  startAllTxDemoRoom(io);
  startAbsolutLabelsRankingRoom(io);
  startSandwichLabelOccurrencesRoom(io);

  console.log(`Server started on port ${port}`);
};
