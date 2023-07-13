import eventEmitter from "../../../goingLive/EventEmitter.js";
import { txDetailEnrichment } from "../../../postgresTables/readFunctions/TxDetailEnrichment.js";
import { getAddressById } from "../../../postgresTables/readFunctions/Pools.js";
import { getModifiedPoolName } from "../../utils/SearchBar.js";
import { getLabelNameFromAddress } from "../../../postgresTables/readFunctions/Labels.js";
export const handleGeneralTxLivestream = (mainRoom, socket) => {
    const newTransactionStreamHandler = async (txId) => {
        const detailedTransaction = await txDetailEnrichment(txId);
        if (detailedTransaction) {
            let poolAddress = await getAddressById(detailedTransaction.pool_id);
            let poolName = await getModifiedPoolName(poolAddress);
            let label = await getLabelNameFromAddress(detailedTransaction.called_contract_by_user);
            if (!label || label.startsWith("Contract Address")) {
                label = detailedTransaction.called_contract_by_user;
            }
            const enrichedTransaction = Object.assign(Object.assign({}, detailedTransaction), { poolAddress: poolAddress, poolName: poolName, calledContractLabel: label });
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
//# sourceMappingURL=GeneralTxLivestream.js.map