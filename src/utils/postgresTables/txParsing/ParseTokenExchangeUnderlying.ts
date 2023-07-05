import { saveCoins, saveTransaction, transactionExists } from "./ParsingHelper.js";
import { TransactionType } from "../../../models/Transactions.js";
import { getCoinsBy, getIdByAddress, getBasePoolBy } from "../readFunctions/Pools.js";
import { findCoinIdByAddress, findCoinDecimalsById } from "../readFunctions/Coins.js";
import { findTransactionsByPoolIdAndHash } from "../readFunctions/Transactions.js";
import { findTransactionCoinsByTxIds } from "../readFunctions/TransactionCoins.js";
import { Decimal } from "decimal.js";
import { CoinMovement } from "../../Interfaces.js";

function findNearestCoinMovementAmount(LP_TRANSFER_AMOUNT: string, COIN_MOVEMENTS_IN_BASEPOOL: CoinMovement[], SOLD_COIN_ADDRESS: string): string | null {
  // Convert LP_TRANSFER_AMOUNT to a Decimal
  const transferAmount = new Decimal(LP_TRANSFER_AMOUNT).dividedBy(new Decimal(10).pow(18));

  // Filter out the movements that match the SOLD_COIN_ADDRESS
  const soldCoinMovements = COIN_MOVEMENTS_IN_BASEPOOL.filter((movement) => movement.coin.address === SOLD_COIN_ADDRESS);

  // Sort the movements by the absolute difference between the transfer amount and the movement amount
  soldCoinMovements.sort((a, b) => {
    // Convert movement amounts to Decimal
    const aAmount = new Decimal(a.amount);
    const bAmount = new Decimal(b.amount);

    return transferAmount.minus(aAmount).abs().comparedTo(transferAmount.minus(bAmount).abs());
  });

  // Return the first (smallest difference) movement
  return soldCoinMovements[0]?.amount;
}

export async function parseTokenExchangeUnderlying(event: any, BLOCK_UNIXTIME: any, POOL_COINS: any): Promise<void> {
  if (await transactionExists(event.eventId)) return;

  let soldCoinEventID = parseInt(event.returnValues.sold_id);
  let soldCoinAmount = event.returnValues.tokens_sold;

  let boughtCoinEventID = parseInt(event.returnValues.bought_id);
  let boughtCoinAmount = event.returnValues.tokens_bought;

  let soldCoinID = null;
  let boughtCoinID = null;

  // if the token_id emitted in the event is = '0', then here the coin is from the pool, eg PUSD in PUSD/3Crv
  // if the token_id is 1,2,..., then we have to find the actual token from the basepool.
  if (soldCoinEventID === 0) {
    const soldCoinAddress = POOL_COINS[soldCoinEventID];
    soldCoinID = await findCoinIdByAddress(soldCoinAddress);
    if (!soldCoinID) return;
    const SOLD_COIN_DECIMALS = await findCoinDecimalsById(soldCoinID);
    if (!SOLD_COIN_DECIMALS) return;
    soldCoinAmount = event.returnValues.tokens_sold / 10 ** SOLD_COIN_DECIMALS;
  } else if (boughtCoinEventID === 0) {
    const boughtCoinAddress = POOL_COINS[boughtCoinEventID];
    boughtCoinID = await findCoinIdByAddress(boughtCoinAddress);
    if (!boughtCoinID) return;
    const BOUGHT_COIN_DECIMALS = await findCoinDecimalsById(boughtCoinID);
    if (!BOUGHT_COIN_DECIMALS) return;
    boughtCoinAmount = event.returnValues.tokens_bought / 10 ** BOUGHT_COIN_DECIMALS;
  }

  if (soldCoinEventID !== 0) {
    //
    const BASEPOOL_ADDRESS = await getBasePoolBy({ id: event.pool_id });
    if (!BASEPOOL_ADDRESS) return;
    const BASEPOOL_ID = await getIdByAddress(BASEPOOL_ADDRESS);
    if (!BASEPOOL_ID) return;
    const BASEPOOL_COINS = await getCoinsBy({ id: BASEPOOL_ID });
    if (!BASEPOOL_COINS) return;
    const SOLD_COIN_ADDRESS = BASEPOOL_COINS[soldCoinEventID - 1];
    soldCoinID = await findCoinIdByAddress(SOLD_COIN_ADDRESS);
    const TRANSFERS_IN_BASEPOOL = await findTransactionsByPoolIdAndHash(BASEPOOL_ID, event.transactionHash);
    const TX_IDS_FROM_TRANSFERS = TRANSFERS_IN_BASEPOOL.map((transfer) => (transfer as any).tx_id);
    const COIN_MOVEMENTS_IN_BASEPOOL = await findTransactionCoinsByTxIds(TX_IDS_FROM_TRANSFERS);
    const LP_AMOUNT = event.returnValues.tokens_sold;
    const NEAREST_COIN_MOVEMENT_AMOUNT = findNearestCoinMovementAmount(LP_AMOUNT, COIN_MOVEMENTS_IN_BASEPOOL, SOLD_COIN_ADDRESS);
    soldCoinAmount = NEAREST_COIN_MOVEMENT_AMOUNT;
  }

  if (boughtCoinEventID !== 0) {
    const BASEPOOL_ADDRESS = await getBasePoolBy({ id: event.pool_id });
    if (!BASEPOOL_ADDRESS) return;
    const BASEPOOL_ID = await getIdByAddress(BASEPOOL_ADDRESS);
    if (!BASEPOOL_ID) return;
    const BASEPOOL_COINS = await getCoinsBy({ id: BASEPOOL_ID });
    if (!BASEPOOL_COINS) return;
    const BOUGHT_COIN_ADDRESS = BASEPOOL_COINS[boughtCoinEventID - 1];
    boughtCoinID = await findCoinIdByAddress(BOUGHT_COIN_ADDRESS);
    const TRANSFERS_IN_BASEPOOL = await findTransactionsByPoolIdAndHash(BASEPOOL_ID, event.transactionHash);
    const TX_IDS_FROM_TRANSFERS = TRANSFERS_IN_BASEPOOL.map((transfer) => (transfer as any).tx_id);
    const COIN_MOVEMENTS_IN_BASEPOOL = await findTransactionCoinsByTxIds(TX_IDS_FROM_TRANSFERS);
    const LP_AMOUNT = event.returnValues.tokens_bought;
    const NEAREST_COIN_MOVEMENT_AMOUNT = findNearestCoinMovementAmount(LP_AMOUNT, COIN_MOVEMENTS_IN_BASEPOOL, BOUGHT_COIN_ADDRESS);
    boughtCoinAmount = NEAREST_COIN_MOVEMENT_AMOUNT;
  }

  const coinAmounts = [
    { COIN_ID: soldCoinID, amount: Number(soldCoinAmount), direction: "out" },
    { COIN_ID: boughtCoinID, amount: Number(boughtCoinAmount), direction: "in" },
  ];

  const transactionData = {
    pool_id: event.pool_id,
    tx_hash: event.transactionHash,
    block_number: event.blockNumber,
    block_unixtime: BLOCK_UNIXTIME,
    transaction_type: TransactionType.Swap,
    trader: event.returnValues.buyer,
    tx_position: event.transactionIndex,
    raw_fees: null,
    fee_usd: null,
    value_usd: null,
    event_id: event.eventId,
  };

  try {
    const transaction = await saveTransaction(transactionData);
    const coinsWithTxId = coinAmounts.map((coin) => ({ tx_id: transaction.tx_id, COIN_ID: coin.COIN_ID, coinAmount: coin.amount, direction: coin.direction }));
    const validCoins = coinsWithTxId.filter((coin) => coin.COIN_ID !== null) as { tx_id: number; COIN_ID: number; coinAmount: number; direction: string }[];

    if (validCoins.length < 2) return;

    await saveCoins(validCoins);
  } catch (error) {
    console.error("Error saving transaction:", error);
  }
}
