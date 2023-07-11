import eventEmitter from "../../../goingLive/EventEmitter.js";
import { txDetailEnrichment } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";
export const handleGeneralTxLivestream = (mainRoom, socket) => {
    const newTransactionStreamHandler = async (txId) => {
        const detailedTransaction = await txDetailEnrichment(txId);
        if (detailedTransaction) {
            mainRoom.in("GeneralTransactionLivestreamRoom").emit("NewGeneralTx", detailedTransaction);
        }
    };
    eventEmitter.on("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);
    socket.on("connectToGeneralTxLivestream", async () => {
        console.log("Client connected to General-Transaction-Livestream.");
        socket.join("GeneralTransactionLivestreamRoom");
    });
    socket.on("disconnect", () => {
        eventEmitter.off("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);
        console.log("Client disconnected.");
    });
};
//# sourceMappingURL=GeneralTxLivestream.js.map