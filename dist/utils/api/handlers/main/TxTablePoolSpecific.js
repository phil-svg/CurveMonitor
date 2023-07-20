import { getIdByAddressCaseInsensitive } from "../../../postgresTables/readFunctions/Pools.js";
import { enrichTransactions, getTransactionIdsForPool } from "../../queries/query_transactions.js";
import { getModifiedPoolName } from "../../utils/SearchBar.js";
export const handlePoolTxLivestream = (socket) => {
    socket.on("getPoolSpecificTransactionTable", async (poolAddress, duration) => {
        try {
            const poolId = await getIdByAddressCaseInsensitive(poolAddress);
            const poolName = await getModifiedPoolName(poolAddress);
            const transactionIds = await getTransactionIdsForPool(duration, poolId);
            const transactionTableContentForPool = await enrichTransactions(transactionIds, poolAddress, poolName);
            socket.emit("TransactionTableContentForPool", transactionTableContentForPool);
        }
        catch (error) {
            console.error(error);
            socket.emit("error", "Internal Server Error");
        }
    });
};
//# sourceMappingURL=TxTablePoolSpecific.js.map