import { Socket } from "socket.io";
import { getModifiedPoolName } from "../../utils/SearchBar.js";

export const handlePoolLabel = (socket: Socket) => {
  socket.on("getPoolLabel", async (poolAddress: string) => {
    try {
      const poolLabel = await getModifiedPoolName(poolAddress);
      socket.emit("poolLabel", poolLabel);
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
