import { saveTransaction, saveCoins, transactionExists } from './ParsingHelper.js';
import { TransactionType } from '../../../models/Transactions.js';
import { getTxReceiptClassic } from '../../web3Calls/generic.js';
import { getCoinIdByAddress, findCoinDecimalsById } from '../readFunctions/Coins.js';
import { decodeTransferEventFromReceipt } from '../../helperFunctions/Web3.js';
import { retry } from '../../helperFunctions/Web3Retry.js';

const ETHER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

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
  let receipt;
  try {
    receipt = await getTxReceiptClassic(event.transactionHash);
  } catch (error) {
    console.error('Error fetching receip for', event.transactionHash);
    return null;
  }
  if (!receipt) {
    return null;
  }

  const TOKEN_TRANSFER_EVENTS = receipt.logs.filter((log: { address: string }) =>
    POOL_COINS.map((addr) => addr.toLowerCase()).includes(log.address.toLowerCase())
  );
  if (TOKEN_TRANSFER_EVENTS.length === 0) return null;

  let decodedLogs;
  try {
    decodedLogs = await decodeTransferEventFromReceipt(TOKEN_TRANSFER_EVENTS);
  } catch (error) {
    // console.log('Error decoding logs for', event.transactionHash);
    return null;
  }

  for (const decodedLog of decodedLogs) {
    if (decodedLog.value === event.returnValues.coin_amount && decodedLog.fromAddress === event.address) {
      return decodedLog.tokenAddress;
    }
  }

  return null;
}

export async function parseRemoveLiquidityOne(event: any, BLOCK_UNIXTIME: any, POOL_COINS: any): Promise<void> {
  // if (await transactionExists(event.eventId)) return;

  if (!POOL_COINS) return;

  let coinAddress = await retry(async () => {
    if (event.returnValues.coin_index) {
      return POOL_COINS[event.returnValues.coin_index];
    } else {
      const addr = await getCoinAddressFromTxReceipt(event, POOL_COINS);

      // Check for the special case when the Address was Ether, since it will not show up as an ERC20-Transfer.
      if (addr === null && POOL_COINS.includes(ETHER)) {
        return ETHER;
      } else if (!addr) {
        return null;
      } else {
        return addr;
      }
    }
  });

  if (!coinAddress) {
    // console.log(`\nNo CoinAddress was found for ${event.transactionHash}`);
    return;
  }

  const COIN_ID = await getCoinIdByAddress(coinAddress);
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
    raw_fees: null,
    fee_usd: null,
    value_usd: null,
    event_id: event.eventId,
  };

  try {
    const transaction = await saveTransaction(transactionData);
    await saveCoins([{ tx_id: transaction.tx_id, COIN_ID: COIN_ID, coinAmount: coinAmount, direction: 'out' }]);
  } catch (error) {
    console.error('Error saving transaction:', error);
  }
}
