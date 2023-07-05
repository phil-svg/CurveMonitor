import { handlePingPong } from "./Ping.js";
import { handleUserSearch } from "./UserSearch.js";
import { handleAbsolutLabelsRankingRoom } from "./AbsolutLabelsRanking.js";
export function startMainEndpoint(io) {
  const defaultRoom = io.of("/default");
  defaultRoom.on("connection", (socket) => {
    console.log("Client connected to Default-Room.");
    handleErrors(socket);
    handlePingPong(socket);
    handleUserSearch(socket);
    handleAbsolutLabelsRankingRoom(socket);
  });
}
function handleErrors(socket) {
  socket.on("error", (error) => {
    console.error(`Error on socket: ${error}`);
  });
}
//# sourceMappingURL=Default.js.map
