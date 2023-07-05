import { getSandwichLabelOccurrences } from "../queries/query_sandwiches.js";
export function handleSandwichLabelOccurrencesRoom(io) {
  const labelsOccurrenceRoom = io.of("/sandwichLabelOccurrences");
  labelsOccurrenceRoom.on("connection", async (socket) => {
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
//# sourceMappingURL=RelativeLabelsRaking.js.map
