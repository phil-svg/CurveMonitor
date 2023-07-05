import { getSuggestions } from "../utils/SearchBar.js";
export const handleUserSearch = (socket) => {
    socket.on("getUserSearchResult", async (userInput) => {
        try {
            const userSearchResult = await getSuggestions(userInput);
            socket.emit("userSearchResult", userSearchResult);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=UserSearch.js.map