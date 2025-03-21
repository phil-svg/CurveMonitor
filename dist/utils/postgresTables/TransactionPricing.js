import { sequelize } from '../../config/Database.js';
import { TransactionType } from '../../models/TransactionType.js';
import { Transactions } from '../../models/Transactions.js';
import { QueryTypes } from 'sequelize';
import { updatePriceMap } from './PriceMap.js';
import { populateTransactionCoinsWithDollarValues } from './TransactionCoins.js';
export async function txPricingLogic(transaction) {
    const DEFAULT_DOLLAR_VALUE = 0.00000004269;
    let volume = 0;
    if (transaction.transaction_type === TransactionType.Swap) {
        if (transaction.coins[0].dollar_value && transaction.coins[0].dollar_value < 50 * 1e9) {
            volume = Number(transaction.coins[0].dollar_value);
        }
        else if (transaction.coins[1] &&
            transaction.coins[1].dollar_value &&
            transaction.coins[1].dollar_value < 50 * 1e9) {
            volume = Number(transaction.coins[1].dollar_value);
        }
    }
    else if (transaction.transaction_type === TransactionType.Deposit) {
        transaction.coins.forEach((coin) => {
            if (coin.dollar_value && coin.direction === 'in' && coin.dollar_value < 50 * 1e9) {
                volume += Number(coin.dollar_value);
            }
        });
    }
    else if (transaction.transaction_type === TransactionType.Remove) {
        transaction.coins.forEach((coin) => {
            if (coin.dollar_value && coin.direction === 'out' && coin.dollar_value < 50 * 1e9) {
                volume += Number(coin.dollar_value);
            }
        });
    }
    if (volume === 0)
        volume = DEFAULT_DOLLAR_VALUE;
    return volume;
}
async function calculateAndUpdateValueUsd(transactions) {
    const transactionsToUpdate = [];
    for (const transaction of transactions) {
        let volume = await txPricingLogic(transaction);
        transactionsToUpdate.push({ tx_id: transaction.tx_id, value_usd: volume });
    }
    await Promise.all(transactionsToUpdate.map(async (transaction) => {
        await Transactions.update({ value_usd: transaction.value_usd }, { where: { tx_id: transaction.tx_id } });
    }));
}
export async function updateValueUsd() {
    const BATCH_SIZE = 40000;
    let remaining = true;
    let progressCounter = 0;
    while (remaining) {
        const batch = await sequelize.query(`
      SELECT 
        t.tx_id, 
        t.transaction_type, 
        tc.dollar_value, 
        tc.direction 
      FROM transactions t
      LEFT JOIN transaction_coins tc ON t.tx_id = tc.tx_id
      WHERE t.value_usd IS NULL
      LIMIT :batchSize
      `, {
            replacements: { batchSize: BATCH_SIZE },
            type: QueryTypes.SELECT,
        });
        /*
        // used to retry to price all tx were pricing had failed before. -start-
        const offset = progressCounter;
        const batch = await sequelize.query<TransactionWithCoins & Coin>(
          `
          SELECT
            t.tx_id,
            t.transaction_type,
            tc.dollar_value,
            tc.direction
          FROM transactions t
          LEFT JOIN transaction_coins tc ON t.tx_id = tc.tx_id
          WHERE t.value_usd = 0.00000004269
          LIMIT :batchSize OFFSET :offset
          `,
          {
            replacements: { batchSize: BATCH_SIZE, offset },
            type: QueryTypes.SELECT,
          }
        );
        // used to retry to price all tx were pricing had failed before. -end-
        */
        // console.log('Pricing batch of', batch.length, 'tx.');
        if (batch.length > 0) {
            const transactions = batch.reduce((acc, row) => {
                const { tx_id, transaction_type, dollar_value, direction } = row;
                if (!acc[tx_id]) {
                    acc[tx_id] = {
                        tx_id,
                        transaction_type,
                        coins: [],
                    };
                }
                acc[tx_id].coins.push({ dollar_value, direction });
                return acc;
            }, {});
            const missingTxToBePriced = Object.values(transactions);
            await calculateAndUpdateValueUsd(missingTxToBePriced);
        }
        else {
            // console.log('No transactions to be priced found.');
            remaining = false;
        }
        progressCounter += batch.length;
        // console.log(`priced ${progressCounter} transactions`);
    }
}
export async function updateValueUsdForSingleTx(tx) {
    const batch = await sequelize.query(`
      SELECT 
        t.tx_id, 
        t.transaction_type, 
        tc.dollar_value, 
        tc.direction 
      FROM transactions t
      LEFT JOIN transaction_coins tc ON t.tx_id = tc.tx_id
      WHERE t.tx_id = :tx_id
      `, {
        replacements: { tx_id: tx.tx_id },
        type: QueryTypes.SELECT,
    });
    // console.log('Pricing batch of', batch.length, 'tx.');
    if (batch.length > 0) {
        const transactions = batch.reduce((acc, row) => {
            const { tx_id, transaction_type, dollar_value, direction } = row;
            if (!acc[tx_id]) {
                acc[tx_id] = {
                    tx_id,
                    transaction_type,
                    coins: [],
                };
            }
            acc[tx_id].coins.push({ dollar_value, direction });
            return acc;
        }, {});
        const missingTxToBePriced = Object.values(transactions);
        await calculateAndUpdateValueUsd(missingTxToBePriced);
    }
}
export async function updateTransactionPricing() {
    await updatePriceMap();
    await populateTransactionCoinsWithDollarValues();
    await updateValueUsd();
    console.log(`[✓] Transaction Values updated successfully.`);
}
//# sourceMappingURL=TransactionPricing.js.map