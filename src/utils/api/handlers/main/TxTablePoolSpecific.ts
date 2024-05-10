import { Socket } from 'socket.io';
import { getIdByAddressCaseInsensitive } from '../../../postgresTables/readFunctions/Pools.js';
import { enrichTransactions, getTransactionIdsForPool } from '../../queries/Transactions.js';
import { getModifiedPoolName } from '../../utils/SearchBar.js';

export const handlePoolTxLivestream = (socket: Socket) => {
  socket.on('getPoolSpecificTransactionTable', async (poolAddress: string, duration: string, page: number) => {
    try {
      const poolId = await getIdByAddressCaseInsensitive(poolAddress);
      const poolName = await getModifiedPoolName(poolAddress);

      const { ids, totalPages } = await getTransactionIdsForPool(duration, poolId!, page);
      const transactionTableContentForPool = await enrichTransactions(ids, poolAddress, poolName!);

      socket.emit('TransactionTableContentForPool', { transactionTableContentForPool, totalPages });
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Internal Server Error');
    }
  });
};
