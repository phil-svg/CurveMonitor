import { Server, Socket } from "socket.io";
import { getSandwichLabelOccurrences } from "../queries/query_sandwiches.js";

export function startSandwichLabelOccurrencesRoom(io: Server): void {
  const labelsOccurrenceRoom = io.of("/sandwichLabelOccurrences");

  labelsOccurrenceRoom.on("connection", async (socket: Socket) => {
    console.log("Client connected to sandwichLabelOccurrences room.");

    socket.on("getSandwichLabelOccurrences", async () => {
      try {
        const labelsOccurrence = await getSandwichLabelOccurrences();
        socket.emit("sandwichLabelOccurrences", labelsOccurrence);
      } catch (error) {
        console.error(error);
        socket.emit("error", "Internal Server Error");
      }
    });
  });
}
