import { IsCexDexArb } from "../../models/IsCexDexArb.js";

export async function storeCexDexArbFlag(txId: number, isArb: boolean): Promise<void> {
  try {
    await IsCexDexArb.upsert({
      tx_id: txId,
      is_cex_dex_arb: isArb,
    });
  } catch (error) {
    console.error(`Error storing CEX-DEX arb flag for txId ${txId}:`, error);
  }
}
