import { Namespace, Socket } from "socket.io";
import eventEmitter from "../../../goingLive/EventEmitter.js";
import { enrichTransactionDetail } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";
import { findBestMatchingBinanceTrade } from "../../../TokenPrices/txValue/binance/BinanceAPI.js";
import { getEnrichedCexDexDetails } from "../../../postgresTables/mevDetection/cexdex/utils/cexdexDetection.js";

export const handleCexDexArbLivestream = (mainRoom: Namespace, socket: Socket) => {
  const newTransactionStreamHandler = async (txId: number) => {
    const enrichedTransaction = await enrichTransactionDetail(txId);

    if (enrichedTransaction) {
      const enrichedCexDexDetails = await getEnrichedCexDexDetails(enrichedTransaction);
      if (enrichedCexDexDetails) {
        const bestMatchingBinanceTrade = await findBestMatchingBinanceTrade(enrichedTransaction);
        // console.log("\nbest match for cexdexarb:", bestMatchingBinanceTrade, "for tx:", enrichedCexDexDetails);
        mainRoom.in("CexDexArbLivestreamRoom").emit("NewCexDexArb", enrichedCexDexDetails, bestMatchingBinanceTrade);
      }
    }
  };

  eventEmitter.on("New Transaction for CexDex-Arb-Livestream", newTransactionStreamHandler);

  socket.on("connectToCexDexArbLivestream", async () => {
    console.log(`Client connected to CexDex-Arb-Livestream.`);
    socket.join("CexDexArbLivestreamRoom");
  });

  socket.on("disconnect", () => {
    eventEmitter.off("New Transaction for CexDex-Arb-Livestream", newTransactionStreamHandler);
    console.log(`Client disconnected.`);
  });
};
