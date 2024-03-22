import {
  findAndSortAllVolsPerUniqueAddressesFromAll,
  getGasUsedArrayForAllTxForAddressAndPoolAndTimeRange,
  getTxHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange,
  getTxIdsForAddressAndPoolAndTimeRange,
} from "../helperFunctions/CrossQueries.js";
import { saveChunkedDataToExcel } from "../helperFunctions/Excel.js";
import { getElementCountChunkedForArrayAndChunksize } from "../helperFunctions/QualityOfLifeStuff.js";
import { getTvlForPoolArrFromChain } from "../postgresTables/Tvl.js";
import { getIdByAddress, getPoolsBySourceAddress } from "../postgresTables/readFunctions/Pools.js";
import { aggregateCexDexBotVolumeOverTime, writeDBotVolOverTimeataToExcel } from "./cexdex/BotVolOverTime.js";
import { calculateTotalVolumeAndVolumePerBot } from "./cexdex/GlobalVolume.js";
import { barChartRace } from "./curvefi/BarChartRace.js";
import { gasUsageThings, getGasUsageFromCsvFile } from "./curvefi/GasUsage.js";
import { priceImpactThings } from "./curvefi/PriceImpact.js";
import { tvlThings } from "./curvefi/Tvl.js";
import { calculateTotalVolumeForTransactionsInDb, generateTopFromVolAddresses, generateTopToVolAddresses, generateTopToVolAddressesForSelectedPools } from "./curvefi/Volume.js";
import { profitableSandwichThings } from "./sandwiches/GoodSandwiches.js";
import {
  calculateLossStatistics,
  createSandwichLossInUsdJsonFile,
  createSandwichLossInUsdJsonFileFor2023,
  fetchSandwichUserLossForAllPoolsForTimePeriod,
  fetchSandwichUserLossForSomePoolsForTimePeriod,
  fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriod,
  fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriodAndCalledContract,
  mosRequest_SandwichVolShareDueToMisconfigRouters,
} from "./sandwiches/Sandwiches.js";
import {
  calculateAndSaveAggregateWeeklyVolumeReport,
  calculateAndSaveDailyAggregateVolumeReport,
  generateVolumeReportForPoolArr,
  generateVolumeReportForSinglePool,
} from "./tricryptoVariations/VolFetch.js";

/*
0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7 3Pool
0xdc24316b9ae028f1497c275eb9192a3ea0f67022 stETH
0xd51a44d3fae010294c616388b506acda1bfaae46 tricrypto2
0x4dece678ceceb27446b35c672dc7d61f30bad69e crvUSD/USDC
0x390f3595bca2df7d23783dfd126427cceb997bf4 crvUSD/USDT
0x7f86bf177dd4f3494b841a37e810a34dd56c829b tricryptoUSDC
0xf5f5b97624542d72a9e06f04804bf81baa15e2b4 tricryptoUSDT
0xa5407eae9ba41422680e2e00537571bcc53efbfd sUSD
0xc5424b857f758e906013f3555dad202e4bdb4567 sETH
0xed279fdd11ca84beef15af5d39bb4d4bee23f0ca lusd
*/

export async function research() {
  const _3Pool = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
  const tricrypto2 = "0xd51a44d3fae010294c616388b506acda1bfaae46";
  const tricryptoUSDT = "0xf5f5b97624542d72a9e06f04804bf81baa15e2b4";
  const tricryptoUSDC = "0x7f86bf177dd4f3494b841a37e810a34dd56c829b";
  const mkUSDUSDC_stableswap_ng = "0xF980B4A4194694913Af231De69AB4593f5E0fCDc";
  const _210 = "0x0f3159811670c117c372428d4e69ac32325e4d0f";
  const _52 = "0x9efe1a1cbd6ca51ee8319afc4573d253c3b732af";

  const ADDRESS_STABESWAP = "0xB9fC157394Af804a3578134A6585C0dc9cc990d4";
  const ADDRESS_STABESWAP_NG = "0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf";
  const stableswapPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP);
  const stableswapNGPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP_NG);

  const bitgetRouter = "0x1A8f43e01B78979EB4Ef7feBEC60F32c9A72f58E";

  const startDate = "2024-02-01";
  const endDate = "2024-03-07";

  console.log("conducting research");

  // await getTvlForPoolArrFromChain(stableswapNGPoolAddressArr, 19319850);
  await generateVolumeReportForPoolArr();
  // await getGasUsageFromCsvFile();
  // await fetchSandwichUserLossForSomePoolsForTimePeriod(stableswapPoolAddressArr, startDate, endDate);
  // await profitableSandwichThings();
  // await gasUsageThings();
  // await createSandwichLossInUsdJsonFileFor2023();
  // await generateVolumeReportForSinglePool(_3Pool, startDate, endDate);
  // await barChartRace();
  // await priceImpactThings();
  // await tvlThings();
  // await fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriodAndCalledContract(tricrypto2, "2023-12-31", "2024-02-01", bitgetRouter);
  // await fetchUniqueSandwichBotOccurrencesForPoolAndTimePeriod(tricrypto2, "2023-12-31", "2024-02-01");
  // await fetchSandwichUserLossForAllPoolsForTimePeriod("2023-12-31", "2024-02-01");
  // await calculateAndSaveDailyAggregateVolumeReport("2023-12-31", "2024-02-01");
  // await calculateAndSaveAggregateWeeklyVolumeReport(1692099809, 1703335409);
  // await generateTopToVolAddressesForSelectedPools(stableswapNGPoolAddressArr, startDate, endDate);
  // await calculateLossStatistics();
  // await createSandwichLossInUsdJsonFile();
  // await generateTopToVolAddresses(1692099809, 1703335409);
  // await generateTopFromVolAddresses(1692099809, 1703335409);
  // await calculateTotalVolumeAndVolumePerBot();
  // await calculateTotalVolumeForTransactionsInDb();
  // await mosRequest_SandwichVolShareDueToMisconfigRouters(); // see => https://twitter.com/phil_00Llama/status/1752327902249492519

  ///***///***///***///***///*** */ */ */ */ */

  // const botAddress = "0xa69babef1ca67a37ffaf7a485dfff3382056e78c";
  // const poolAddress = "0x7f86bf177dd4f3494b841a37e810a34dd56c829b";

  // const cexDexBotVolumeOverTime = await aggregateCexDexBotVolumeOverTime(botAddress, poolAddress);
  // console.log("cexDexBotVolumeOverTime", cexDexBotVolumeOverTime);
  // await writeDBotVolOverTimeataToExcel(cexDexBotVolumeOverTime);
  // console.log("done");

  ///***///***///***///***///*** */ */ */ */ */
  // mo's research
  // const poolAddress = "0x7f86bf177dd4f3494b841a37e810a34dd56c829b";
  // const targetAddress = "0xa69babef1ca67a37ffaf7a485dfff3382056e78c";
  // const startDate = "2024-01-01";
  // const endDate = "2024-01-30";

  // Part 1

  // console.time("getGasUsedArrayForAllTxForAddressAndPoolAndTimeRange");
  // // const txIdsForAddressAndPoolAndTimeRange = await getTxIdsForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate);
  // const gasUsedArrayForAllTxForAddressAndPoolAndTimeRange = await getGasUsedArrayForAllTxForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate);
  // console.log("gasUsedArrayForAllTxForAddressAndPoolAndTimeRange", gasUsedArrayForAllTxForAddressAndPoolAndTimeRange);
  // console.timeEnd("getGasUsedArrayForAllTxForAddressAndPoolAndTimeRange");
  // console.log("gasUsedArrayForAllTxForAddressAndPoolAndTimeRange.length", gasUsedArrayForAllTxForAddressAndPoolAndTimeRange.length);

  // const elementCountChunkedForArrayAndChunksize = getElementCountChunkedForArrayAndChunksize(gasUsedArrayForAllTxForAddressAndPoolAndTimeRange, 1000);
  // console.log("elementCountChunkedForArrayAndChunksize", elementCountChunkedForArrayAndChunksize);

  // await saveChunkedDataToExcel(elementCountChunkedForArrayAndChunksize);

  // Part 2

  // const numOfResults = 1;
  // const lowerGasUsageBoundary = 0;
  // const biggerGasUsageBoundary = 178000;
  // const txHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange = await getTxHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange(
  //   poolAddress,
  //   targetAddress,
  //   startDate,
  //   endDate,
  //   numOfResults,
  //   lowerGasUsageBoundary,
  //   biggerGasUsageBoundary
  // );
  // console.log("txHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange", txHashExampleArrayForGasUsedForAddressAndPoolAndTimeRange);

  ///***///***///***///***///*** */ */ */ */ */

  // await printSortedVolumeSummary();9
  // await printCexDexPoolDistribution();

  // const cexdexbots = await countAndSortUniqueBotAddresses();
  // console.log("cexdexbots", cexdexbots);

  // const botAddress = "0x000000000dfde7deaf24138722987c9a6991e2d4";
  // const poolNameCount = await countUniquePoolsForBot(botAddress);
  // console.log("poolNameCount", poolNameCount);

  ///***///***///***///***///*** */ */ */ */ */
  // Sell Buy Ratios For Bots and Pools
  // const botAddress = "0xa69babef1ca67a37ffaf7a485dfff3382056e78c";
  // const botAddress = "0x6f1cdbbb4d53d226cf4b917bf768b94acbab6168";
  // const botAddress = "0xe8cfad4c75a5e1caf939fd80afcf837dde340a69";
  // const botAddress = "0x5050e08626c499411b5d0e0b5af0e83d3fd82edf";
  // const botAddress = "0x51c72848c68a965f66fa7a88855f9f7784502a7f";
  // const botAddress = "0x000000000dfde7deaf24138722987c9a6991e2d4";

  // const poolAddress = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46"; // tricrypto2
  // const poolAddress = "0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B"; // tricryptoUSDC
  // const poolAddress = "0xf5f5B97624542D72A9E06f04804Bf81baA15e2B4"; // tricryptoUSDT
  // const poolAddress = "0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14"; // triCRV
  // const poolAddress = "0x3211c6cbef1429da3d0d58494938299c92ad5860"; // STG/USDC
  // const poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"; // 3Pool
  // const poolAddress = "0x6a6283ab6e31c2aec3fa08697a8f806b740660b2"; // RSR+FRAX/USDC/fraxbp)

  // const countedCoinSwapsForBotAndPool = await countCoinSwapsForBotAndPool(botAddress, poolAddress);
  // console.log("countedCoinSwapsForBotAndPool", countedCoinSwapsForBotAndPool);

  // process.exit();
  ///***///***///***///***///*** */ */ */ */ */

  // const botAddress = "0xa69babef1ca67a37ffaf7a485dfff3382056e78c";
  // const poolAddress = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";

  // const cexDexBotVolumeOverTime = await aggregateCexDexBotVolumeOverTime(botAddress, poolAddress);
  // console.log("cexDexBotVolumeOverTime", cexDexBotVolumeOverTime);
  // await writeDBotVolOverTimeataToExcel(cexDexBotVolumeOverTime);
  // console.log("done");
  // process.exit();

  ///***///***///***///***///*** */ */ */ */ */

  // console.log("conductin research");
  // const poolAddress = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
  // const targetAddress = "0xa69babef1ca67a37ffaf7a485dfff3382056e78c";
  // const startDate = "2024-01-01";
  // const endDate = "2024-01-30";
  // console.time("getTxIdsForAddressAndPoolAndTimeRange");
  // const txIdsForAddressAndPoolAndTimeRange = await getTxIdsForAddressAndPoolAndTimeRange(poolAddress, targetAddress, startDate, endDate);
  // console.log("txIdsForAddressAndPoolAndTimeRange", txIdsForAddressAndPoolAndTimeRange);
  // console.timeEnd("getTxIdsForAddressAndPoolAndTimeRange");
  // console.log("txIdsForAddressAndPoolAndTimeRange.length", txIdsForAddressAndPoolAndTimeRange.length);

  ///***///***///***///***///*** */ */ */ */ */

  // const foundAndSortedAllVolsPerUniqueAddressesFromAll = await findAndSortAllVolsPerUniqueAddressesFromAll();
  // console.log("foundAndSortedAllVolsPerUniqueAddressesFromAll", foundAndSortedAllVolsPerUniqueAddressesFromAll);

  ///***///***///***///***///*** */ */ */ */ */
}
