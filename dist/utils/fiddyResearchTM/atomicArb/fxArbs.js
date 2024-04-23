import { getCleanedTransfersForTxHashFromTable } from '../../postgresTables/readFunctions/CleanedTransfers.js';
import { getPoolIdsByAddresses } from '../../postgresTables/readFunctions/Pools.js';
import { getFromAddress } from '../../postgresTables/readFunctions/TransactionDetails.js';
import { fetchTransactionsForPoolAndTime } from '../../postgresTables/readFunctions/Transactions.js';
export async function fxThings() {
    const startDate = '2023-03-20';
    const endDate = '2024-04-20';
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolId = await getPoolIdsByAddresses(['0xd6982da59f1d26476e259559508f4135135cf9b8']);
    if (!poolId[0])
        return;
    const transactions = await fetchTransactionsForPoolAndTime(poolId[0], startUnixTime, endUnixTime);
    let revenueinEth = 0;
    let numOfArbs = 0;
    for (const transaction of transactions) {
        const fromAddress = await getFromAddress(transaction.tx_id);
        if (!fromAddress)
            continue;
        const cleanedTransfers = await getCleanedTransfersForTxHashFromTable(transaction.tx_hash);
        if (!cleanedTransfers)
            continue;
        const lastTransfer = cleanedTransfers[cleanedTransfers.length - 1];
        if (lastTransfer.to.toLowerCase() === fromAddress.toLowerCase() && lastTransfer.tokenSymbol === 'ETH') {
            numOfArbs++;
            revenueinEth += lastTransfer.parsedAmount;
        }
    }
    console.log('revenueinEth', revenueinEth);
    console.log('numOfArbs', numOfArbs);
}
//# sourceMappingURL=fxArbs.js.map