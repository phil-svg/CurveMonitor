import { Server, Socket } from "socket.io";
import { getSuggestions } from "../../utils/SearchBar.js";

export const handleUserSearch = (socket: Socket) => {
  socket.on("getUserSearchResult", async (userInput: string) => {
    try {
      const userSearchResult = await getSuggestions(userInput);
      socket.emit("userSearchResult", userSearchResult);
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
