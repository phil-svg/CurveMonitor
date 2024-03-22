import { Op } from "sequelize";
import { AtomicArbs } from "../../../models/AtomicArbs.js";
import { Transactions } from "../../../models/Transactions.js";
import { getTxHashByTxId } from "./Transactions.js";

/**
 * Filters out transaction IDs that have already been checked for atomic arbitrage.
 * @param transactionIds Array of transaction IDs to filter.
 * @returns Array of transaction IDs that have not been checked for atomic arbitrage.
 */
export async function filterUncheckedTransactionIds(transactionIds: number[]): Promise<number[]> {
  try {
    const checkedTxIds = await AtomicArbs.findAll({
      where: {
        tx_id: {
          [Op.in]: transactionIds,
        },
      },
      attributes: ["tx_id"],
    });
    const checkedIdsSet = new Set(checkedTxIds.map((tx) => tx.tx_id));
    const uncheckedTransactionIds = transactionIds.filter((id) => !checkedIdsSet.has(id));
    return uncheckedTransactionIds;
  } catch (error) {
    console.error("Error filtering transaction IDs:", error);
    throw error;
  }
}

export async function fetchAtomicArbsForPoolAndTime(poolId: number, startUnixtime: number, endUnixtime: number): Promise<number[]> {
  const atomicArbs = await AtomicArbs.findAll({
    where: {
      is_atomic_arb: true,
      "$transaction.pool_id$": poolId,
      "$transaction.block_unixtime$": {
        [Op.gte]: startUnixtime,
        [Op.lt]: endUnixtime,
      },
    },
    include: [
      {
        model: Transactions,
        required: true,
        attributes: [],
      },
    ],
    raw: true,
  });

  return atomicArbs.map((arb) => arb.tx_id);
}

export async function printTopUniqueRevenueEntries(lowerBound: number, higherBound: number) {
  try {
    // Ensure bounds are valid
    if (lowerBound < 1 || higherBound < lowerBound) {
      throw new Error("Invalid bounds provided");
    }

    // Fetch a larger set of entries to account for potential duplicates
    const topRevenues = await AtomicArbs.findAll({
      where: {
        revenue: { [Op.ne]: null }, // Filter out entries where revenue is null
      },
      order: [["revenue", "DESC"]], // Order by revenue in descending order
      limit: higherBound * 5, // Increase limit to ensure we can filter down to the desired range
    });

    const uniqueTxHashes = new Set<string>();
    const uniqueEntries: typeof topRevenues = [];

    for (const entry of topRevenues) {
      const txHash = await getTxHashByTxId(entry.tx_id);

      // Add entry to unique list if txHash is not already included
      if (!uniqueTxHashes.has(txHash!)) {
        uniqueTxHashes.add(txHash!);
        uniqueEntries.push(entry);

        // Stop once we have enough unique entries to cover the higher bound
        if (uniqueEntries.length >= higherBound) {
          break;
        }
      }
    }

    // Extract the desired range from uniqueEntries
    const selectedEntries = uniqueEntries.slice(lowerBound - 1, higherBound);

    // Printing the rounded revenue and unique transaction hash for each entry
    for (const entry of selectedEntries) {
      const txHash = await getTxHashByTxId(entry.tx_id);
      console.log(`Revenue: ${Math.round(entry.revenue as number)}, TxHash: ${txHash}`);
    }
  } catch (error) {
    console.error("Error fetching top unique revenue entries:", error);
  }
}

export async function getAtomicArbEntryByTxIdShort(txId: number) {
  const entry = await AtomicArbs.findOne({
    where: { tx_id: txId },
    attributes: ["is_atomic_arb", "revenue"],
  });

  return entry ? entry.dataValues : null;
}

export async function getTxIdsWithAtomicArb(): Promise<number[]> {
  const atomicArbs = await AtomicArbs.findAll({
    attributes: ["tx_id"],
    where: {
      is_atomic_arb: true,
    },
  });

  return atomicArbs.map((arb) => arb.tx_id);
}
