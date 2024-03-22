import { getAllTxIdsFromIsCexDexArb } from "../../readFunctions/IsCexDexArb.js";

export async function filterProcessedTxIds(allTxIds: number[]): Promise<number[]> {
  const excludedTxIdsArray = await getAllTxIdsFromIsCexDexArb();
  const excludedTxIdsSet = new Set(excludedTxIdsArray);

  const filteredTxIds = allTxIds.filter((txId) => !excludedTxIdsSet.has(txId));

  return filteredTxIds;
}
