import { initServer } from "./Server.js";
import { getLabelsRankingDecendingAbsOccurences, getTotalAmountOfSandwichesInLocalDB, getTotalExtractedFromCurve } from "./queries/query_sandwiches.js";

export async function startAPI() {
  initServer();
  console.log(`[✓] Server launched`);
}
