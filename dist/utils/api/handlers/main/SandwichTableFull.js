import { getFullSandwichTable } from "../../queries/query_sandwiches.js";
export const handleFullSandwichRoom = (socket) => {
    socket.on("getFullSandwichTableContent", async (timeDuration, page) => {
        try {
            const { data, totalPages } = await getFullSandwichTable(timeDuration, page);
            socket.emit("fullSandwichTableContent", { data, totalPages });
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=SandwichTableFull.js.map