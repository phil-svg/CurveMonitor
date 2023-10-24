import { Namespace, Socket } from "socket.io";
import eventEmitter from "../../../goingLive/EventEmitter.js";
import { enrichTransactionDetail } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";

export const handleGeneralTxLivestream = (mainRoom: Namespace, socket: Socket) => {
  const newTransactionStreamHandler = async (txId: number) => {
    const enrichedTransaction = await enrichTransactionDetail(txId);

    if (enrichedTransaction) mainRoom.in("GeneralTransactionLivestreamRoom").emit("NewGeneralTx", enrichedTransaction);
  };

  eventEmitter.on("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);

  socket.on("connectToGeneralTxLivestream", async () => {
    console.log(`Client connected to General-Transaction-Livestream.`);
    socket.join("GeneralTransactionLivestreamRoom");
  });

  socket.on("disconnect", () => {
    eventEmitter.off("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);
    console.log(`Client disconnected.`);
  });
};
