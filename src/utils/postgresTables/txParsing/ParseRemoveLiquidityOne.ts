import { saveTransaction } from "./ParsingHelper.js";
import { TransactionType } from "../../../models/Transactions.js";
import { getBlockTimeStamp, getTxReceipt } from "../../web3Calls/generic.js";
import { getCoinsBy } from "../readFunctions/Pools.js";
import { findCoinIdByAddress, findCoinDecimalsById } from "../readFunctions/Coins.js";
import { Transactions } from "../../../models/Transactions.js";
import { decodeTransferEventFromReceipt } from "../../helperFunctions/Web3.js";

async function transactionExists(eventId: number): Promise<boolean> {
  const existingTransaction = await Transactions.findOne({ where: { event_id: eventId } });
  return !!existingTransaction;
}

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
async function getCoinAddressFromTxReceipt(event: any, POOL_COINS: string[]): Promise<string | null> {
  const RECEIPT = await getTxReceipt(event.transactionHash);
  if (!RECEIPT) return null;
  const TOKEN_TRANSFER_EVENTS = RECEIPT.logs.filter((log) => POOL_COINS.includes(log.address));
  if (TOKEN_TRANSFER_EVENTS.length === 0) return null;

  let decodedLogs = decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS);

  for (const decodedLog of decodedLogs) {
    if (decodedLog.value === event.returnValues.coin_amount && decodedLog.fromAddress === event.address) {
      return decodedLog.tokenAddress;
    }
  }

  return null;
}

export async function parseRemoveLiquidityOne(event: any): Promise<void> {
  if (await transactionExists(event.eventId)) return;

  const BLOCK_UNIXTIME = await getBlockTimeStamp(event.blockNumber);

  const POOL_COINS = await getCoinsBy({ id: event.pool_id });
  if (!POOL_COINS) return;

  let coinAddress;
  if (event.returnValues.coin_index) {
    coinAddress = POOL_COINS[event.returnValues.coin_index];
  } else {
    coinAddress = await getCoinAddressFromTxReceipt(event, POOL_COINS);
    if (!coinAddress) return;
  }

  const COIN_ID = await findCoinIdByAddress(coinAddress);
  if (!COIN_ID) return;

  const COIN_DECIMALS = await findCoinDecimalsById(COIN_ID);
  if (!COIN_DECIMALS) return;

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
    fee_usd: null,
    value_usd: null,
    event_id: event.eventId,
  };

  try {
    await saveTransaction(transactionData);
  } catch (error) {
    console.error("Error saving transaction:", error);
  }
}
