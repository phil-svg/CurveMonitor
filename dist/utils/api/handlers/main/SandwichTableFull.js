import { getFullSandwichTable } from "../../queries/query_sandwiches.js";
export const handleFullSandwichRoom = (socket) => {
    socket.on("getFullSandwichTableContent", async (timeDuration) => {
        try {
            const fullTableContent = await getFullSandwichTable(timeDuration);
            socket.emit("fullSandwichTableContent", fullTableContent);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=SandwichTableFull.js.map