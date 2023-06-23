import { initServer } from "./Server.js";
import { getLabelsRankingDecendingAbsOccurences, getTotalAmountOfSandwichesInLocalDB, getTotalExtractedFromCurve } from "./queries/query_sandwiches.js";

export async function startAPI() {
  console.log("welcome to curvemonitor, sit up right, drink water, and keep spirits up high!\n");
  //

  initServer();
  console.log(`[✓] Server launched`);
}
