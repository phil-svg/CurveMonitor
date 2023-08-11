import { Server, Socket } from "socket.io";
import { handlePingPong } from "./Ping.js";
import { handleUserSearch } from "./UserSearch.js";
import { handleAbsolutLabelsRankingRoom } from "./AbsolutLabelsRanking.js";
import { handleSandwichLabelOccurrencesRoom } from "./RelativeLabelsRaking.js";
import { handleSandwichGeneralLivestream } from "./SandwichGeneralLivestream.js";
import { handleFullSandwichRoom } from "./SandwichTableFull.js";
import { handlePoolSandwichRoom } from "./SandwichTablePoolSpecfic.js";
import { handleGeneralTxLivestream } from "./GeneralTxLivestream.js";
import { handlePoolTxLivestream } from "./TxTablePoolSpecific.js";

export function startMainEndpoint(io: Server): void {
  console.log(`main channel booting..`);
  const mainRoom = io.of("/main");

  mainRoom.on("connection", (socket: Socket) => {
    console.log("Client connected to Main-Room.");
    handleErrors(socket);
    handlePingPong(socket);
    handleUserSearch(socket);
    handleAbsolutLabelsRankingRoom(socket);
    handleSandwichLabelOccurrencesRoom(socket);
    handleSandwichGeneralLivestream(mainRoom, socket);
    handleFullSandwichRoom(socket);
    handlePoolSandwichRoom(socket);
    handleGeneralTxLivestream(mainRoom, socket);
    handlePoolTxLivestream(socket);
  });
}

function handleErrors(socket: Socket) {
  socket.on("error", (error: any) => {
    console.error(`Error on socket: ${error}`);
  });
}
