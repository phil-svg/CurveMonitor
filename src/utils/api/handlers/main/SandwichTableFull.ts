import { Socket } from "socket.io";
import { getFullSandwichTable } from "../../queries/query_sandwiches.js";

export const handleFullSandwichRoom = (socket: Socket) => {
  socket.on("getFullSandwichTableContent", async (timeDuration: string) => {
    try {
      const fullTableContent = await getFullSandwichTable(timeDuration);
      socket.emit("fullSandwichTableContent", fullTableContent);
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
