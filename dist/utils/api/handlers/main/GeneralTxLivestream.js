import eventEmitter from "../../../goingLive/EventEmitter.js";
import { enrichTransactionDetail } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";
export const handleGeneralTxLivestream = (mainRoom, socket) => {
    const newTransactionStreamHandler = async (txId) => {
        const enrichedTransaction = await enrichTransactionDetail(txId);
        if (enrichedTransaction)
            mainRoom.in("GeneralTransactionLivestreamRoom").emit("NewGeneralTx", enrichedTransaction);
    };
    eventEmitter.on("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);
    socket.on("connectToGeneralTxLivestream", async () => {
        console.log(`[${Math.floor(Date.now() / 1000)}] Client connected to General-Transaction-Livestream.`);
        socket.join("GeneralTransactionLivestreamRoom");
    });
    socket.on("disconnect", () => {
        eventEmitter.off("New Transaction for General-Transaction-Livestream", newTransactionStreamHandler);
        console.log(`[${Math.floor(Date.now() / 1000)}] Client disconnected.`);
    });
};
//# sourceMappingURL=GeneralTxLivestream.js.map