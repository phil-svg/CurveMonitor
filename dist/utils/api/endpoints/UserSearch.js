import { getSuggestions } from "../utils/SearchBar.js";
export async function handleUserSearch(io) {
  const searchBarRoom = io.of("/searchBar");
  searchBarRoom.on("connection", async (socket) => {
    console.log("Client connected to searchBar room.");
    socket.on("getUserSearchResult", async (userInput) => {
      try {
        const userSearchResult = await getSuggestions(userInput);
        socket.emit("userSearchResult", userSearchResult);
      } catch (error) {
        console.error(error);
        socket.emit("error", "Internal Server Error");
      }
    });
  });
}
//# sourceMappingURL=UserSearch.js.map
