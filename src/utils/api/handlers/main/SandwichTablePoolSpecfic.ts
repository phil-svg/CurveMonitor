import { Socket } from "socket.io";
import { getSandwichTableContentForPool } from "../../queries/query_sandwiches.js";
import { getIdByAddressCaseInsensitive } from "../../../postgresTables/readFunctions/Pools.js";

export const handlePoolSandwichRoom = (socket: Socket) => {
  socket.on("getPoolSpecificSandwichTable", async (poolAddress: string, duration: string) => {
    try {
      const poolId = await getIdByAddressCaseInsensitive(poolAddress);
      const SandwichTableContentForPool = await getSandwichTableContentForPool(poolId!, duration);
      socket.emit("SandwichTableContentForPool", SandwichTableContentForPool);
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
