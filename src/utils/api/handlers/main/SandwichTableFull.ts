import { Socket } from "socket.io";
import { getFullSandwichTable } from "../../queries/query_sandwiches.js";

export const handleFullSandwichRoom = (socket: Socket) => {
  socket.on("getFullSandwichTableContent", async (timeDuration: string, page: number) => {
    try {
      const { sandwiches, totalPages } = await getFullSandwichTable(timeDuration, page);
      socket.emit("fullSandwichTableContent", { sandwiches, totalPages });
    } catch (error) {
      console.error(error);
      socket.emit("error", "Internal Server Error");
    }
  });
};
