import { AtomicArbs } from "../../models/AtomicArbs.js";
import { TransactionDetailsForAtomicArbs } from "../Interfaces.js";

export async function insertAtomicArbDetails(txId: number, arbDetails: TransactionDetailsForAtomicArbs | "not an arb"): Promise<void> {
  try {
    if (arbDetails === "not an arb") {
      await AtomicArbs.upsert({
        tx_id: txId,
        is_atomic_arb: false,
      });
      return;
    }

    // If arbDetails is a full TransactionDetailsForAtomicArbs object, insert all details
    const { tx_id, revenue, gasInUsd, gasInGwei, netWin, bribe, totalCost, blockBuilder, validatorPayOffUSD } = arbDetails;
    await AtomicArbs.upsert({
      tx_id: tx_id,
      is_atomic_arb: true,
      revenue: revenue ?? null,
      gas_in_usd: gasInUsd ?? null,
      gas_in_gwei: gasInGwei ?? null,
      net_win: netWin ?? null,
      bribe: bribe ?? null,
      total_cost: totalCost ?? null,
      block_builder: blockBuilder ?? null,
      block_payout_to_validator: validatorPayOffUSD ?? null,
    });
  } catch (error) {
    console.error("Error inserting atomic arb record:", error);
  }
}
