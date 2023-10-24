import eventEmitter from "../../../goingLive/EventEmitter.js";
export const handleAtomicArbLivestream = (mainRoom, socket) => {
    const newTransactionStreamHandler = async (atomicArbDetails) => {
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
//# sourceMappingURL=AtomicArbLivestream.js.map