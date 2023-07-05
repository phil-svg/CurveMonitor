import { handlePingPong } from "./Ping.js";
import { handleUserSearch } from "./UserSearch.js";
import { handleAbsolutLabelsRankingRoom } from "./AbsolutLabelsRanking.js";
import { handleSandwichLabelOccurrencesRoom } from "./RelativeLabelsRaking.js";
import { handleSandwichGeneralLivestream } from "./SandwichGeneralLivestream.js";
export function startMainEndpoint(io) {
    const mainRoom = io.of("/main");
    mainRoom.on("connection", (socket) => {
        console.log("Client connected to Main-Room.");
        handleErrors(socket);
        handlePingPong(socket);
        handleUserSearch(socket);
        handleAbsolutLabelsRankingRoom(socket);
        handleSandwichLabelOccurrencesRoom(socket);
        handleSandwichGeneralLivestream(mainRoom, socket);
    });
}
function handleErrors(socket) {
    socket.on("error", (error) => {
        console.error(`Error on socket: ${error}`);
    });
}
//# sourceMappingURL=Index.js.map