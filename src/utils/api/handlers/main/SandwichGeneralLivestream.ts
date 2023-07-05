import { Namespace, Server, Socket } from "socket.io";
import eventEmitter from "../../../goingLive/EventEmitter.js";
import { SandwichDetailEnrichment } from "../../../postgresTables/readFunctions/SandwichDetailEnrichments.js";
import { isExtractedFromCurve } from "../../../postgresTables/readFunctions/Sandwiches.js";

export const handleSandwichGeneralLivestream = (mainRoom: Namespace, socket: Socket) => {
  const newSandwichHandler = async (sandwichId: number) => {
    const extracted = await isExtractedFromCurve(sandwichId);

    if (extracted) {
      const detailedSandwich = await SandwichDetailEnrichment(sandwichId);

      mainRoom.in("GeneralSandwichLivestreamRoom").emit("NewSandwich", detailedSandwich);
    }
  };

  eventEmitter.on("New Sandwich for General-Sandwich-Livestream-Subscribers", newSandwichHandler);

  socket.on("connectToGeneralSandwichLivestream", async () => {
    console.log("Client connected to General-Sandwich-Livestream.");
    socket.join("GeneralSandwichLivestreamRoom");
  });

  socket.on("disconnect", () => {
    eventEmitter.off("New Sandwich for General-Sandwich-Livestream-Subscribers", newSandwichHandler);
    console.log("Client disconnected.");
  });
};
