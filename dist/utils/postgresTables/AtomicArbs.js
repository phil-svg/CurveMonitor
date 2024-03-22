import { AtomicArbs } from "../../models/AtomicArbs.js";
export async function insertAtomicArbDetails(txId, arbDetails) {
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
            revenue: revenue !== null && revenue !== void 0 ? revenue : null,
            gas_in_usd: gasInUsd !== null && gasInUsd !== void 0 ? gasInUsd : null,
            gas_in_gwei: gasInGwei !== null && gasInGwei !== void 0 ? gasInGwei : null,
            net_win: netWin !== null && netWin !== void 0 ? netWin : null,
            bribe: bribe !== null && bribe !== void 0 ? bribe : null,
            total_cost: totalCost !== null && totalCost !== void 0 ? totalCost : null,
            block_builder: blockBuilder !== null && blockBuilder !== void 0 ? blockBuilder : null,
            block_payout_to_validator: validatorPayOffUSD !== null && validatorPayOffUSD !== void 0 ? validatorPayOffUSD : null,
        });
    }
    catch (error) {
        console.error("Error inserting atomic arb record:", error);
    }
}
//# sourceMappingURL=AtomicArbs.js.map