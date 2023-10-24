import { Namespace, Socket } from "socket.io";
import eventEmitter from "../../../goingLive/EventEmitter.js";
import { TransactionDetailsForAtomicArbs } from "../../../Interfaces.js";

export const handleAtomicArbLivestream = (mainRoom: Namespace, socket: Socket) => {
  const newTransactionStreamHandler = async (atomicArbDetails: TransactionDetailsForAtomicArbs) => {
    mainRoom.in("AtomicArbLivestreamRoom").emit("NewAtomicArb", atomicArbDetails);
  };

  eventEmitter.on("New Transaction for Atomic-Arb-Livestream", newTransactionStreamHandler);

  socket.on("connectToAtomicArbLivestream", async () => {
    console.log(`Client connected to Atomic-Arb-Livestream.`);
    socket.join("AtomicArbLivestreamRoom");
  });

  socket.on("disconnect", () => {
    eventEmitter.off("New Transaction for Atomic-Arb-Livestream", newTransactionStreamHandler);
    console.log(`Client disconnected.`);
  });
};
