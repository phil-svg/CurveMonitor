import { saveCoins, saveTransaction, transactionExists } from './ParsingHelper.js';
import { TransactionType } from '../../../models/TransactionType.js';
import { getCoinIdByAddress, findCoinDecimalsById } from '../readFunctions/Coins.js';

export async function parseTokenExchange(event: any, BLOCK_UNIXTIME: any, POOL_COINS: any): Promise<void> {
  // if (await transactionExists(event.eventId)) return;
  if (!POOL_COINS) return;

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

  const soldCoinAddress = POOL_COINS[event.returnValues.sold_id];
  const boughtCoinAddress = POOL_COINS[event.returnValues.bought_id];

  const SOLD_COIN_ID = await getCoinIdByAddress(soldCoinAddress);
  if (!SOLD_COIN_ID) return;
  const SOLD_COIN_DECIMALS = await findCoinDecimalsById(SOLD_COIN_ID);
  if (!SOLD_COIN_DECIMALS && SOLD_COIN_DECIMALS !== 0) return;
  let soldCoinAmount = event.returnValues.tokens_sold / 10 ** SOLD_COIN_DECIMALS;

  const BOUGHT_COIN_ID = await getCoinIdByAddress(boughtCoinAddress);
  if (!BOUGHT_COIN_ID) return;
  const BOUGHT_COIN_DECIMALS = await findCoinDecimalsById(BOUGHT_COIN_ID);
  if (!BOUGHT_COIN_DECIMALS && BOUGHT_COIN_DECIMALS !== 0) return;
  let boughtCoinAmount = event.returnValues.tokens_bought / 10 ** BOUGHT_COIN_DECIMALS;

  const coinAmounts = [
    { COIN_ID: SOLD_COIN_ID, amount: Number(soldCoinAmount.toFixed(15)), direction: 'out' },
    { COIN_ID: BOUGHT_COIN_ID, amount: Number(boughtCoinAmount.toFixed(15)), direction: 'in' },
  ];

  try {
    const transaction = await saveTransaction(transactionData);
    await saveCoins(
      coinAmounts.map((coin) => ({
        tx_id: transaction.tx_id,
        COIN_ID: coin.COIN_ID,
        coinAmount: coin.amount,
        direction: coin.direction,
      }))
    );
  } catch (error) {
    console.error('Error saving transaction:', error);
  }
}
