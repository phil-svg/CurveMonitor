import { getExtractedSandwichesByPoolId } from "../../postgresTables/readFunctions/Sandwiches.js";
export async function foo() {
    const poolId = 333;
    console.time();
    let extractedSandwichesByPoolId = await getExtractedSandwichesByPoolId(poolId);
    for (const rawSandwichEntry of extractedSandwichesByPoolId) {
        console.log("rawSandwichEntry", rawSandwichEntry);
        process.exit();
    }
    console.timeEnd();
}
/*
const allPoolIds = await getAllPoolIds();
for (const poolId of allPoolIds) {
  let extractedSandwichesByPoolId = await getExtractedSandwichesByPoolId(poolId);
  counter += extractedSandwichesByPoolId.length;
  for (const rawSandwichEntry of extractedSandwichesByPoolId) {
    const lossInPercentage = rawSandwichEntry.dataValues.loss_transactions[0].lossInPercentage;
    console.log("lossInPercentage", lossInPercentage);
  }
}
*/
/*
const sandwichId = 325;
const enrichedSandwich = await SandwichDetailEnrichment(sandwichId);
console.log("enrichedSandwich", enrichedSandwich);
console.dir(enrichedSandwich, { depth: null, colors: true });
*/
//# sourceMappingURL=SandwichesDetailed.js.map