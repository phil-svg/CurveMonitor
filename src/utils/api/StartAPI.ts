import { initServer } from "./Server.js";
import { getLabelsRankingDecendingAbsOccurences, getTotalAmountOfSandwichesInLocalDB, getTotalExtractedFromCurve } from "./queries/query_sandwiches.js";

export async function startAPI() {
  console.log("It works again!\n");
  //

  initServer();
  console.log(`[✓] Server launched`);
}
