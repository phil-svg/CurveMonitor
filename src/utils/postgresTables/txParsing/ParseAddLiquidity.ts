import { saveCoins, saveTransaction, transactionExists } from './ParsingHelper.js';
import { TransactionType } from '../../../models/Transactions.js';
import { getCoinsBy } from '../readFunctions/Pools.js';
import { getCoinIdByAddress, findCoinDecimalsById } from '../readFunctions/Coins.js';
import { Coin } from '../../Interfaces.js';

export async function parseAddLiquidity(event: any, BLOCK_UNIXTIME: any, POOL_COINS: any): Promise<void> {
  // if (await transactionExists(event.eventId)) return;

  if (!POOL_COINS) return;

  const transactionData = {
    pool_id: event.pool_id,
    tx_hash: event.transactionHash,
    block_number: event.blockNumber,
    block_unixtime: BLOCK_UNIXTIME,
    transaction_type: TransactionType.Deposit,
    trader: event.returnValues.provider,
    tx_position: event.transactionIndex,
    raw_fees: null,
    fee_usd: null,
    value_usd: null,
    event_id: event.eventId,
  };

  const coinAddresses = await getCoinsBy({ id: event.pool_id });
  if (!coinAddresses) return;

  const coinAmounts: (Coin | undefined)[] = await Promise.all(
    coinAddresses.map(async (address, index) => {
      const COIN_ID = await getCoinIdByAddress(address);
      if (!COIN_ID) return;
      const COIN_DECIMALS = await findCoinDecimalsById(COIN_ID);
      if (!COIN_DECIMALS) return;
      let coinAmount = event.returnValues.token_amounts[index] / 10 ** COIN_DECIMALS;
      return {
        COIN_ID,
        amount: Number(coinAmount.toFixed(15)),
      } as Coin;
    })
  );

  try {
    const transaction = await saveTransaction(transactionData);
    await saveCoins(
      coinAmounts
        .filter((coin): coin is Coin => coin !== undefined)
        .map((coin) => ({
          tx_id: transaction.tx_id,
          COIN_ID: coin.COIN_ID,
          coinAmount: coin.amount,
          direction: 'in',
        }))
    );
  } catch (error) {
    console.error('Error saving transaction:', error);
  }
}
