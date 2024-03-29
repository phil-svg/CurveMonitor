import { Socket } from "socket.io";
import { getSandwichTableContentForPool } from "../../queries/query_sandwiches.js";
import { getIdByAddressCaseInsensitive } from "../../../postgresTables/readFunctions/Pools.js";

export const handlePoolSandwichRoom = (socket: Socket) => {
  socket.on("getPoolSpecificSandwichTable", async (poolAddress: string, duration: string, page: number) => {
    try {
      const poolId = await getIdByAddressCaseInsensitive(poolAddress);
      const { data, totalSandwiches } = await getSandwichTableContentForPool(poolId!, duration, page);
      socket.emit("SandwichTableContentForPool", { data, totalSandwiches });
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
