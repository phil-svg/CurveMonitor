import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { Transactions } from "../../../models/Transactions.js";
import { Coins } from "../../../models/Coins.js";
import { TransactionCalls } from "../../../models/TransactionCalls.js";
export async function txDetailEnrichment(txId) {
    const transaction = await Transactions.findOne({
        where: { tx_id: txId },
        include: [
            {
                model: TransactionCoins,
                include: [Coins],
            },
        ],
    });
    const transactionCall = await TransactionCalls.findOne({
        where: { txId: txId },
    });
    if (!transaction || !transactionCall)
        return null;
    const coinsLeavingWallet = [];
    const coinsEnteringWallet = [];
    for (const txCoin of transaction.transactionCoins) {
        const coinDetail = {
            coin_id: txCoin.coin_id,
            amount: txCoin.amount,
            name: txCoin.coin.symbol,
            address: txCoin.coin.address,
        };
        txCoin.direction === "out" ? coinsLeavingWallet.push(coinDetail) : coinsEnteringWallet.push(coinDetail);
    }
    const txDetail = {
        tx_id: transaction.tx_id,
        pool_id: transaction.pool_id,
        event_id: transaction.event_id,
        tx_hash: transaction.tx_hash,
        block_number: transaction.block_number,
        block_unixtime: transaction.block_unixtime,
        transaction_type: transaction.transaction_type,
        called_contract_by_user: transactionCall.called_address,
        trader: transaction.trader,
        tx_position: transaction.tx_position,
        coins_leaving_wallet: coinsLeavingWallet,
        coins_entering_wallet: coinsEnteringWallet,
    };
    return txDetail;
}
//# sourceMappingURL=TxDetailEnrichment.js.map