import { IsCexDexArb } from "../../../models/IsCexDexArb.js";

export async function getAllTxIdsFromIsCexDexArb(): Promise<number[]> {
  try {
    const records = await IsCexDexArb.findAll({
      attributes: ["tx_id"],
      raw: true,
    });

    return records.map((record) => record.tx_id);
  } catch (error) {
    console.error("Error retrieving transaction IDs from is_cex_dex_arb:", error);
    return [];
  }
}
