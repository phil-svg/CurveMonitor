import { getModifiedPoolName } from "../../utils/SearchBar.js";
export const handlePoolLabel = (socket) => {
    socket.on("getPoolLabel", async (poolAddress) => {
        try {
            const poolLabel = await getModifiedPoolName(poolAddress);
            socket.emit("getPoolLabel", poolLabel);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=PoolLabels.js.map