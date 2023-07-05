import { handlePingPong } from "./Ping.js";
import { handleAbsolutLabelsRankingRoom } from "./AbsolutLabelsRanking.js";
import { handleSandwichLabelOccurrencesRoom } from "./RelativeLabelsRaking.js";
import { handleUserSearch } from "./UserSearch.js";
export function startMainEndpoint(io) {
  const mainRoom = io.of("/main");
  mainRoom.on("connection", (socket) => {
    console.log("Client connected to Default-Room.");
    handlePingPong(socket);
    handleAbsolutLabelsRankingRoom(socket);
    handleSandwichLabelOccurrencesRoom(socket);
    handleUserSearch(socket);
  });
}
//# sourceMappingURL=Defffault.js.map
