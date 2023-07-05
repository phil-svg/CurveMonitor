import { getSandwichLabelOccurrences } from "../../queries/query_sandwiches.js";
export const handleSandwichLabelOccurrencesRoom = (socket) => {
    socket.on("getSandwichLabelOccurrences", async () => {
        try {
            const labelsOccurrence = await getSandwichLabelOccurrences();
            socket.emit("sandwichLabelOccurrences", labelsOccurrence);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=RelativeLabelsRaking.js.map