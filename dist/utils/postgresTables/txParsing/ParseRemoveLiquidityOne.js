import { saveTransaction, transactionExists } from "./ParsingHelper.js";
import { TransactionType } from "../../../models/Transactions.js";
import { getTxReceipt } from "../../web3Calls/generic.js";
import { findCoinIdByAddress, findCoinDecimalsById } from "../readFunctions/Coins.js";
import { decodeTransferEventFromReceipt } from "../../helperFunctions/Web3.js";
const ETHER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
/**
 * Retrieves the address of the token that was removed during a liquidity event.
 *
 * @param event - The event emitted by the contract, for example RemoveLiquidityOne.
 * @param POOL_COINS - An array containing the addresses of pool tokens.
 * @returns The address of the removed token.
 *
 * If the token addresses are not included in the event, the transaction receipt is retrieved.
 * The receipt is then searched for an entry that mentions a token included in the pool.
 * After double-checking to ensure that the correct transfer is identified, the function
 * returns the address of the token.
 */
async function getCoinAddressFromTxReceipt(event, POOL_COINS) {
    const RECEIPT = await getTxReceipt(event.transactionHash);
    if (!RECEIPT)
        return null;
    const TOKEN_TRANSFER_EVENTS = RECEIPT.logs.filter((log) => POOL_COINS.map((addr) => addr.toLowerCase()).includes(log.address.toLowerCase()));
    if (TOKEN_TRANSFER_EVENTS.length === 0)
        return null;
    let decodedLogs = decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS);
    for (const decodedLog of decodedLogs) {
        if (decodedLog.value === event.returnValues.coin_amount && decodedLog.fromAddress === event.address) {
            return decodedLog.tokenAddress;
        }
    }
    return null;
}
export async function parseRemoveLiquidityOne(event, BLOCK_UNIXTIME, POOL_COINS) {
    if (await transactionExists(event.eventId))
        return;
    if (!POOL_COINS)
        return;
    let coinAddress;
    if (event.returnValues.coin_index) {
        coinAddress = POOL_COINS[event.returnValues.coin_index];
    }
    else {
        coinAddress = await getCoinAddressFromTxReceipt(event, POOL_COINS);
        // Check for the special case when the Address was Ether, since it will not show up as and ERC20-Transfer.
        if (coinAddress === null && POOL_COINS.includes(ETHER)) {
            coinAddress = ETHER;
        }
        else if (!coinAddress) {
            return;
        }
    }
    const COIN_ID = await findCoinIdByAddress(coinAddress);
    if (!COIN_ID)
        return;
    const COIN_DECIMALS = await findCoinDecimalsById(COIN_ID);
    if (!COIN_DECIMALS)
        return;
    let coinAmount = event.returnValues.coin_amount / 10 ** COIN_DECIMALS;
    coinAmount = Number(coinAmount.toFixed(15));
    const transactionData = {
        pool_id: event.pool_id,
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        block_unixtime: BLOCK_UNIXTIME,
        transaction_type: TransactionType.Remove,
        trader: event.returnValues.provider,
        tx_position: event.transactionIndex,
        amount_in: null,
        coin_id_in: null,
        amount_out: coinAmount,
        coin_id_out: COIN_ID,
        raw_fees: null,
        fee_usd: null,
        value_usd: null,
        event_id: event.eventId,
    };
    try {
        await saveTransaction(transactionData);
    }
    catch (error) {
        console.error("Error saving transaction:", error);
    }
}
//# sourceMappingURL=ParseRemoveLiquidityOne.js.map