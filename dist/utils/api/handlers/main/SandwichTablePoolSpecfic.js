import { getSandwichTableContentForPool } from "../../queries/query_sandwiches.js";
import { getIdByAddressCaseInsensitive } from "../../../postgresTables/readFunctions/Pools.js";
export const handlePoolSandwichRoom = (socket) => {
    socket.on("getPoolSpecificSandwichTable", async (poolAddress, duration) => {
        try {
            const poolId = await getIdByAddressCaseInsensitive(poolAddress);
            const SandwichTableContentForPool = await getSandwichTableContentForPool(poolId, duration);
            socket.emit("SandwichTableContentForPool", SandwichTableContentForPool);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=SandwichTablePoolSpecfic.js.map