import { IsCexDexArb } from "../../models/IsCexDexArb.js";
export async function storeCexDexArbFlag(txId, isArb) {
    try {
        await IsCexDexArb.upsert({
            tx_id: txId,
            is_cex_dex_arb: isArb,
        });
    }
    catch (error) {
        console.error(`Error storing CEX-DEX arb flag for txId ${txId}:`, error);
    }
}
//# sourceMappingURL=IsCexDexArb.js.map