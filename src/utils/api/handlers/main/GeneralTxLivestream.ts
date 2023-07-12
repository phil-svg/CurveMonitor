import { Namespace, Socket } from "socket.io";
import eventEmitter from "../../../goingLive/EventEmitter.js";
import { txDetailEnrichment } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";
import { getAddressById } from "../../../postgresTables/readFunctions/Pools.js";
import { getModifiedPoolName } from "../../utils/SearchBar.js";
import { EnrichedTransactionDetail } from "../../../../Client.js";

export const handleGeneralTxLivestream = (mainRoom: Namespace, socket: Socket) => {
  const newTransactionStreamHandler = async (txId: number) => {
    const detailedTransaction = await txDetailEnrichment(txId);
    if (detailedTransaction) {
      let poolAddress = await getAddressById(detailedTransaction.pool_id);
      let poolName = await getModifiedPoolName(poolAddress!);

      const enrichedTransaction: EnrichedTransactionDetail = {
        ...detailedTransaction,
        poolAddress: poolAddress!,
        poolName: poolName!,
      };

      mainRoom.in("GeneralTransactionLivestreamRoom").emit("NewGeneralTx", enrichedTransaction);
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
