import { Coins } from "../../../models/Coins.js";
import { TransactionCoins } from "../../../models/TransactionCoins.js";
import { ITransactionTrace } from "../../Interfaces.js";
import { getMethodIdsForPoolAddressLight } from "../../helperFunctions/MethodID.js";
import { convertDateToUnixTime } from "../../helperFunctions/QualityOfLifeStuff.js";
import { findCoinAddressBySymbol } from "../../postgresTables/readFunctions/Coins.js";
import { getCoinsBy, getIdByAddress, getNCoinsBy, getPoolsBySourceAddress } from "../../postgresTables/readFunctions/Pools.js";
import { getTransactionTraceFromDb } from "../../postgresTables/readFunctions/TransactionTrace.js";
import { fetchTxHashesForPoolAndTime, getTxIdByTxHash, getUnixTimestampByTxId } from "../../postgresTables/readFunctions/Transactions.js";
import { saveGasUsagesByFunctionNamesAndPoolsAndTimeToExcel } from "../utils/Excel.js";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { createObjectCsvWriter } from "csv-writer";
import { getGasUsedFromReceipt } from "../../postgresTables/readFunctions/Receipts.js";
import { getGasPriceInGwei, getTransactionCostInUSD } from "../../postgresTables/mevDetection/atomic/utils/atomicArbDetection.js";
import { getEthPriceWithTimestampFromTable } from "../../postgresTables/readFunctions/PriceMap.js";

function filterTxTracesByPoolAddress(txTraces: ITransactionTrace[], poolAddress: string): ITransactionTrace[] {
  const poolAddressLowerCase = poolAddress.toLowerCase();

  return txTraces.filter((txTrace) => {
    return txTrace.action.to && txTrace.action.to.toLowerCase() === poolAddressLowerCase;
  });
}

async function checkIfTxWasCoinSymbolRemoval(txId: number, coinSymbol: string): Promise<boolean> {
  const transactionCoin = await TransactionCoins.findOne({
    include: [
      {
        model: Coins,
        where: { symbol: coinSymbol },
        required: true,
      },
    ],
    where: {
      tx_id: txId,
      direction: "out",
    },
  });

  return !!transactionCoin;
}

async function checkIfTxWasCoinSymbolSupplyAdd(txId: number, coinSymbol: string): Promise<boolean> {
  const transactionCoin = await TransactionCoins.findOne({
    include: [
      {
        model: Coins,
        where: { symbol: coinSymbol },
        required: true,
      },
    ],
    where: {
      tx_id: txId,
      direction: "in",
    },
  });

  return !!transactionCoin;
}

async function checkIfTxHasMultipleEntries(txId: number): Promise<boolean> {
  // Count the number of entries for the given txId in the TransactionCoins table
  const count = await TransactionCoins.count({
    where: {
      tx_id: txId,
    },
  });

  // Check if the count is greater than 1
  return count > 1;
}

export interface MethodId {
  name: string;
  signature: string;
  methodId: string;
}

export async function getGasUsedArrayForPoolAndFunction(poolAddress: string, functionName: string, txHash: string): Promise<number[]> {
  const txTraces = await getTransactionTraceFromDb(txHash);
  const tracesFilteredForToIsPool = filterTxTracesByPoolAddress(txTraces, poolAddress);
  // console.log("tracesFilteredForToIsPool", tracesFilteredForToIsPool);

  const methodIdsForPoolAddressLight = await getMethodIdsForPoolAddressLight(poolAddress);
  // console.log("methodIdsForPoolAddressLight", methodIdsForPoolAddressLight);
  if (!methodIdsForPoolAddressLight) return [];

  // Filter for methodIds that match the functionName
  const relevantMethodIds = methodIdsForPoolAddressLight
    .filter((method) => method.name.toLowerCase() === functionName.toLowerCase())
    .map((method) => method.methodId.toLowerCase());

  // Map over traces and extract gasUsed where input matches one of the relevant methodIds
  return tracesFilteredForToIsPool
    .filter((trace) => relevantMethodIds.some((methodId) => trace.action.input.toLowerCase().startsWith(methodId)))
    .map((trace) => parseInt(trace.result.gasUsed, 16));
}

// Next: write new ts function called getAllTxHashesForPoolAndTimeWindow(pool,startDate..
async function getAllTxHashesForPoolAndTimeWindow(poolAddress: string, startDate: string, endDate: string): Promise<string[] | null> {
  const poolId = await getIdByAddress(poolAddress);
  if (!poolId) {
    console.log("failed to fetch poolId for", poolAddress, "in getAllTxHashesForPoolAndTimeWindow");
    return null;
  }
  const startUnix = convertDateToUnixTime(startDate);
  const endUnix = convertDateToUnixTime(endDate);

  const txHashesForPoolAndTime = await fetchTxHashesForPoolAndTime(poolId, startUnix, endUnix);
  return txHashesForPoolAndTime;
}

function getGasUsageBracket(gasUsed: number): string {
  const bracketSize = 2500;
  const lowerBound = Math.floor(gasUsed / bracketSize) * bracketSize;
  const upperBound = lowerBound + bracketSize - 1;
  return `${lowerBound}-${upperBound}`;
}

function sortGasUsageBrackets(gasUsageBrackets: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const sortedGasUsageBrackets: Record<string, Record<string, number>> = {};

  // Iterate through each function name
  Object.keys(gasUsageBrackets).forEach((functionName) => {
    const brackets = gasUsageBrackets[functionName];
    const sortedBracketsArray = Object.entries(brackets).sort((a, b) => {
      // Extract the start of the range from the bracket string and convert to number for comparison
      const rangeA = parseInt(a[0].split("-")[0]);
      const rangeB = parseInt(b[0].split("-")[0]);
      return rangeA - rangeB; // Ascending order
    });

    // Convert sorted array back into object
    sortedGasUsageBrackets[functionName] = sortedBracketsArray.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, number>);
  });

  return sortedGasUsageBrackets;
}

type GasUsageBrackets = Record<string, Record<string, number>>;

function convertCountsToPercentages(sortedGasUsageBrackets: GasUsageBrackets): Record<string, Record<string, number>> {
  const percentageBrackets: Record<string, Record<string, number>> = {};

  // Iterate through each function name
  for (const functionName in sortedGasUsageBrackets) {
    const brackets = sortedGasUsageBrackets[functionName];
    const totalCounts = Object.values(brackets).reduce((sum, current) => sum + current, 0);

    // Initialize the object for the current function if not already done
    percentageBrackets[functionName] = percentageBrackets[functionName] || {};

    // Convert each bracket's count to a percentage of the total count
    for (const bracket in brackets) {
      const count = brackets[bracket];
      const percentage = (count / totalCounts) * 100;
      const roundedPercentage = Math.round(percentage); // Round to the nearest whole number
      percentageBrackets[functionName][bracket] = roundedPercentage;
    }
  }

  return percentageBrackets;
}

async function getGasUsageBrackets(stableswapPoolAddressArr: string[], startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
  let gasUsageBrackets: Record<string, Record<string, number>> = {};
  // const relevantFunctionNames = ["exchange", "exchange_underlying", "add_liquidity", "remove_liquidity_one_coin", "remove_liquidity", "exchange_received"];
  const relevantFunctionNames = ["exchange_received"];

  let gasUsageChecks = 0,
    txHashesChecks = 0,
    poolChecks = 0,
    numOfCounts = 0,
    poolCounter = 0;

  poolChecks += stableswapPoolAddressArr.length;
  for (const poolAddress of stableswapPoolAddressArr) {
    poolCounter++;
    const allTxHashes = await getAllTxHashesForPoolAndTimeWindow(poolAddress, startDate, endDate);
    if (!allTxHashes) continue;
    txHashesChecks += allTxHashes.length;
    let localTxCounter = 0;

    for (const functionName of relevantFunctionNames) {
      if (!gasUsageBrackets[functionName]) {
        gasUsageBrackets[functionName] = {};
      }

      for (const txHash of allTxHashes) {
        localTxCounter++;
        if (localTxCounter % 100 === 0) {
          console.log("Pool: " + poolCounter + "/" + poolChecks, "Pool Progress:", (100 * (localTxCounter / (allTxHashes.length * relevantFunctionNames.length))).toFixed(0) + "%");
        }
        const gasUsages = await getGasUsedArrayForPoolAndFunction(poolAddress, functionName, txHash);
        gasUsageChecks++;
        for (const gasUsed of gasUsages) {
          console.log(poolAddress, txHash, gasUsed);
          numOfCounts++;
          const bracket = getGasUsageBracket(gasUsed);
          gasUsageBrackets[functionName][bracket] = (gasUsageBrackets[functionName][bracket] || 0) + 1;
        }
      }
    }
  }

  console.log("Checked", poolChecks, "pools,", txHashesChecks, "txHashes, and comepleted", gasUsageChecks, "gasUsagesChecks, numResults:", numOfCounts);

  const sortedGasUsageBrackets = sortGasUsageBrackets(gasUsageBrackets);
  return sortedGasUsageBrackets;
}

async function getGasUsageBracketsForSpecificConditions(stableswapPoolAddressArr: string[], startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
  let gasUsageBrackets: Record<string, Record<string, number>> = {};
  const relevantFunctionNames = ["add_liquidity"];

  const targetCoinSymbol = "WETH";
  const N_COIN_CONDITION = 2;

  let gasUsageChecks = 0,
    txHashesChecks = 0,
    poolChecks = 0,
    numResults = 0,
    poolCounter = 0;

  poolChecks += stableswapPoolAddressArr.length;
  for (const poolAddress of stableswapPoolAddressArr) {
    const N_COINS = await getNCoinsBy({ address: poolAddress });
    if (N_COINS !== N_COIN_CONDITION) continue;

    const poolCoins = await getCoinsBy({ address: poolAddress });

    const targetCoinAddress = await findCoinAddressBySymbol(targetCoinSymbol);
    if (!poolCoins!.some((coinAddress) => coinAddress.toLowerCase() === targetCoinAddress!.toLowerCase())) continue;

    poolCounter++;
    const allTxHashes = await getAllTxHashesForPoolAndTimeWindow(poolAddress, startDate, endDate);
    if (!allTxHashes) continue;

    console.log("\npoolAddress", poolAddress);
    txHashesChecks += allTxHashes.length;
    let localTxCounter = 0;

    for (const functionName of relevantFunctionNames) {
      if (!gasUsageBrackets[functionName]) {
        gasUsageBrackets[functionName] = {};
      }

      for (const txHash of allTxHashes) {
        localTxCounter++;

        if (localTxCounter % 100 === 0) {
          console.log("Pool: " + poolCounter + "/" + poolChecks, "Pool Progress:", (100 * (localTxCounter / (allTxHashes.length * relevantFunctionNames.length))).toFixed(0) + "%");
        }
        const gasUsages = await getGasUsedArrayForPoolAndFunction(poolAddress, functionName, txHash);
        gasUsageChecks++;
        if (gasUsages.length === 0) continue;
        const txId = await getTxIdByTxHash(txHash);

        const wasCoinAndFunction = await checkIfTxWasCoinSymbolSupplyAdd(txId!, targetCoinSymbol);
        if (!wasCoinAndFunction) continue;

        const functionHadMultiple = await checkIfTxHasMultipleEntries(txId!);
        if (functionHadMultiple) continue;

        for (const gasUsed of gasUsages) {
          numResults++;
          // console.log(txHash, "gasUsed:", gasUsed);
          const bracket = getGasUsageBracket(gasUsed);
          gasUsageBrackets[functionName][bracket] = (gasUsageBrackets[functionName][bracket] || 0) + 1;
        }
      }
    }
  }

  console.log("Checked", poolChecks, "pools,", txHashesChecks, "txHashes, and comepleted", gasUsageChecks, "gasUsagesChecks, numResults:", numResults);

  const sortedGasUsageBrackets = sortGasUsageBrackets(gasUsageBrackets);
  return sortedGasUsageBrackets;
}

async function articleThings(): Promise<void> {
  const ADDRESS_STABESWAP = "0xB9fC157394Af804a3578134A6585C0dc9cc990d4";
  const ADDRESS_STABESWAP_NG = "0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf";
  const stableswapPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP);
  const stableswapNGPoolAddressArr = await getPoolsBySourceAddress(ADDRESS_STABESWAP_NG);

  // used for the articles screenshots:
  // const startDate = "2023-11-01";
  // const endDate = "2024-02-09";

  const startDate = "2023-12-01T00:00:00+01:00";
  const endDate = "2024-03-03T19:00:00+01:00"; // 3 PM Berlin time on 2024-02-20

  // const gasUsageBrackets = await getGasUsageBrackets(stableswapNGPoolAddressArr, startDate, endDate);
  const gasUsageBrackets = await getGasUsageBrackets(stableswapNGPoolAddressArr, startDate, endDate);
  console.log("gasUsageBrackets", gasUsageBrackets);

  // const gasUsageBracketsConvertedToPercentage = convertCountsToPercentages(gasUsageBrackets);

  await saveGasUsagesByFunctionNamesAndPoolsAndTimeToExcel(gasUsageBrackets);
}

export async function gasUsageThings(): Promise<void> {
  // exchange, exchange_underlying, add_liquidity, remove_liquidity_one_coin, remove_liquidity, exchange_received

  // const txHash = "0xda359fccd075576e7359ff2f0017a13abdd7d4b3f9ca1a61429bce978264b085";
  // const poolAddress = "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea";
  // const gasUsages = await getGasUsedArrayForPoolAndFunction(poolAddress, "add_liquidity", txHash);
  // console.log("gasUsages", gasUsages);

  await articleThings();
}

const oneYearOfStableswap = {
  exchange: {
    "27500-29999": 32,
    "30000-32499": 26,
    "32500-34999": 28,
    "35000-37499": 16,
    "37500-39999": 20,
    "40000-42499": 78,
    "42500-44999": 101,
    "45000-47499": 431,
    "47500-49999": 1412,
    "50000-52499": 1485,
    "52500-54999": 1629,
    "55000-57499": 656,
    "57500-59999": 1619,
    "60000-62499": 1166,
    "62500-64999": 1329,
    "65000-67499": 1884,
    "67500-69999": 1137,
    "70000-72499": 805,
    "72500-74999": 708,
    "75000-77499": 1507,
    "77500-79999": 3926,
    "80000-82499": 1814,
    "82500-84999": 2039,
    "85000-87499": 3104,
    "87500-89999": 4614,
    "90000-92499": 2926,
    "92500-94999": 2174,
    "95000-97499": 2656,
    "97500-99999": 1731,
    "100000-102499": 2305,
    "102500-104999": 2681,
    "105000-107499": 4896,
    "107500-109999": 3889,
    "110000-112499": 3411,
    "112500-114999": 3367,
    "115000-117499": 1703,
    "117500-119999": 911,
    "120000-122499": 478,
    "122500-124999": 733,
    "125000-127499": 621,
    "127500-129999": 589,
    "130000-132499": 510,
    "132500-134999": 831,
    "135000-137499": 1148,
    "137500-139999": 821,
    "140000-142499": 471,
    "142500-144999": 347,
    "145000-147499": 459,
    "147500-149999": 159,
    "150000-152499": 137,
    "152500-154999": 332,
    "155000-157499": 213,
    "157500-159999": 197,
    "160000-162499": 237,
    "162500-164999": 60,
    "165000-167499": 98,
    "167500-169999": 113,
    "170000-172499": 80,
    "172500-174999": 39,
    "175000-177499": 194,
    "177500-179999": 141,
    "180000-182499": 28,
    "182500-184999": 155,
    "185000-187499": 60,
    "187500-189999": 13,
    "190000-192499": 20,
    "192500-194999": 92,
    "195000-197499": 37,
    "197500-199999": 20,
    "200000-202499": 10,
    "202500-204999": 45,
    "205000-207499": 12,
    "207500-209999": 14,
    "210000-212499": 19,
    "212500-214999": 8,
    "215000-217499": 2,
    "217500-219999": 1,
    "220000-222499": 1,
    "222500-224999": 7,
    "225000-227499": 1,
    "227500-229999": 1,
    "230000-232499": 1,
    "235000-237499": 1,
    "237500-239999": 1,
    "265000-267499": 1,
    "267500-269999": 1,
    "272500-274999": 2,
    "275000-277499": 1,
    "282500-284999": 1,
    "292500-294999": 2,
    "300000-302499": 1,
    "322500-324999": 1,
    "327500-329999": 1,
    "335000-337499": 3,
    "352500-354999": 2,
    "387500-389999": 1,
    "390000-392499": 1,
    "405000-407499": 1,
    "407500-409999": 2,
    "480000-482499": 1,
    "507500-509999": 1,
    "622500-624999": 1,
    "3255000-3257499": 5,
    "3860000-3862499": 1,
  },
  exchange_underlying: {
    "125000-127499": 12,
    "127500-129999": 16,
    "130000-132499": 133,
    "132500-134999": 62,
    "135000-137499": 53,
    "137500-139999": 38,
    "140000-142499": 21,
    "142500-144999": 28,
    "145000-147499": 36,
    "147500-149999": 82,
    "150000-152499": 190,
    "152500-154999": 168,
    "155000-157499": 480,
    "157500-159999": 323,
    "160000-162499": 269,
    "162500-164999": 165,
    "165000-167499": 251,
    "167500-169999": 253,
    "170000-172499": 174,
    "172500-174999": 219,
    "175000-177499": 126,
    "177500-179999": 198,
    "180000-182499": 125,
    "182500-184999": 302,
    "185000-187499": 235,
    "187500-189999": 236,
    "190000-192499": 267,
    "192500-194999": 192,
    "195000-197499": 62,
    "197500-199999": 57,
    "200000-202499": 147,
    "202500-204999": 70,
    "205000-207499": 614,
    "207500-209999": 251,
    "210000-212499": 412,
    "212500-214999": 392,
    "215000-217499": 291,
    "217500-219999": 512,
    "220000-222499": 386,
    "222500-224999": 540,
    "225000-227499": 771,
    "227500-229999": 1309,
    "230000-232499": 1035,
    "232500-234999": 851,
    "235000-237499": 441,
    "237500-239999": 520,
    "240000-242499": 445,
    "242500-244999": 396,
    "245000-247499": 678,
    "247500-249999": 938,
    "250000-252499": 840,
    "252500-254999": 554,
    "255000-257499": 527,
    "257500-259999": 228,
    "260000-262499": 303,
    "262500-264999": 291,
    "265000-267499": 280,
    "267500-269999": 272,
    "270000-272499": 239,
    "272500-274999": 236,
    "275000-277499": 253,
    "277500-279999": 157,
    "280000-282499": 120,
    "282500-284999": 280,
    "285000-287499": 299,
    "287500-289999": 327,
    "290000-292499": 282,
    "292500-294999": 167,
    "295000-297499": 231,
    "297500-299999": 229,
    "300000-302499": 391,
    "302500-304999": 469,
    "305000-307499": 436,
    "307500-309999": 380,
    "310000-312499": 292,
    "312500-314999": 269,
    "315000-317499": 222,
    "317500-319999": 139,
    "320000-322499": 158,
    "322500-324999": 178,
    "325000-327499": 102,
    "327500-329999": 109,
    "330000-332499": 170,
    "332500-334999": 85,
    "335000-337499": 105,
    "337500-339999": 88,
    "340000-342499": 94,
    "342500-344999": 35,
    "345000-347499": 36,
    "347500-349999": 49,
    "350000-352499": 68,
    "352500-354999": 13,
    "355000-357499": 27,
    "357500-359999": 28,
    "360000-362499": 6,
    "362500-364999": 8,
    "365000-367499": 7,
    "367500-369999": 7,
    "370000-372499": 10,
    "372500-374999": 6,
    "375000-377499": 7,
    "377500-379999": 2,
    "380000-382499": 2,
    "382500-384999": 3,
    "385000-387499": 3,
    "390000-392499": 3,
    "392500-394999": 3,
    "395000-397499": 1,
    "397500-399999": 2,
    "402500-404999": 1,
    "410000-412499": 2,
    "412500-414999": 1,
    "420000-422499": 2,
    "425000-427499": 3,
    "427500-429999": 2,
    "430000-432499": 2,
    "432500-434999": 1,
    "437500-439999": 1,
    "445000-447499": 1,
    "490000-492499": 1,
    "3960000-3962499": 1,
    "4130000-4132499": 1,
  },
  add_liquidity: {
    "37500-39999": 4,
    "45000-47499": 42,
    "47500-49999": 8,
    "50000-52499": 24,
    "52500-54999": 34,
    "55000-57499": 55,
    "57500-59999": 35,
    "60000-62499": 29,
    "62500-64999": 55,
    "65000-67499": 164,
    "67500-69999": 12,
    "70000-72499": 52,
    "72500-74999": 30,
    "75000-77499": 33,
    "77500-79999": 51,
    "80000-82499": 47,
    "82500-84999": 203,
    "85000-87499": 104,
    "87500-89999": 152,
    "90000-92499": 94,
    "92500-94999": 85,
    "95000-97499": 149,
    "97500-99999": 396,
    "100000-102499": 1151,
    "102500-104999": 216,
    "105000-107499": 1425,
    "107500-109999": 612,
    "110000-112499": 216,
    "112500-114999": 526,
    "115000-117499": 1680,
    "117500-119999": 1618,
    "120000-122499": 408,
    "122500-124999": 424,
    "125000-127499": 187,
    "127500-129999": 810,
    "130000-132499": 620,
    "132500-134999": 318,
    "135000-137499": 297,
    "137500-139999": 289,
    "140000-142499": 424,
    "142500-144999": 374,
    "145000-147499": 184,
    "147500-149999": 199,
    "150000-152499": 143,
    "152500-154999": 208,
    "155000-157499": 20,
    "157500-159999": 143,
    "160000-162499": 86,
    "162500-164999": 76,
    "165000-167499": 72,
    "167500-169999": 25,
    "170000-172499": 61,
    "172500-174999": 25,
    "175000-177499": 33,
    "177500-179999": 18,
    "180000-182499": 21,
    "182500-184999": 49,
    "185000-187499": 192,
    "187500-189999": 60,
    "190000-192499": 34,
    "192500-194999": 57,
    "195000-197499": 34,
    "197500-199999": 30,
    "200000-202499": 20,
    "202500-204999": 31,
    "205000-207499": 16,
    "207500-209999": 58,
    "210000-212499": 245,
    "212500-214999": 18,
    "215000-217499": 25,
    "217500-219999": 16,
    "220000-222499": 9,
    "222500-224999": 15,
    "225000-227499": 2,
    "227500-229999": 5,
    "230000-232499": 2,
    "232500-234999": 20,
    "235000-237499": 14,
    "237500-239999": 2,
    "240000-242499": 1,
    "242500-244999": 6,
    "245000-247499": 16,
    "247500-249999": 1,
    "250000-252499": 2,
    "265000-267499": 1,
    "270000-272499": 1,
    "272500-274999": 1,
    "280000-282499": 1,
    "285000-287499": 1,
    "287500-289999": 1,
    "292500-294999": 1,
    "295000-297499": 1,
    "297500-299999": 1,
    "302500-304999": 5,
    "310000-312499": 1,
    "317500-319999": 1,
    "320000-322499": 1,
    "325000-327499": 1,
    "362500-364999": 1,
    "392500-394999": 1,
    "530000-532499": 1,
    "637500-639999": 1,
    "845000-847499": 1,
  },
  remove_liquidity_one_coin: {
    "30000-32499": 4,
    "37500-39999": 6,
    "45000-47499": 3,
    "47500-49999": 10,
    "50000-52499": 19,
    "55000-57499": 16,
    "57500-59999": 459,
    "60000-62499": 23,
    "62500-64999": 15,
    "65000-67499": 7,
    "67500-69999": 3,
    "70000-72499": 12,
    "72500-74999": 21,
    "75000-77499": 29,
    "77500-79999": 52,
    "80000-82499": 16,
    "82500-84999": 74,
    "85000-87499": 275,
    "87500-89999": 225,
    "90000-92499": 475,
    "92500-94999": 329,
    "95000-97499": 135,
    "97500-99999": 110,
    "100000-102499": 86,
    "102500-104999": 133,
    "105000-107499": 605,
    "107500-109999": 557,
    "110000-112499": 133,
    "112500-114999": 247,
    "115000-117499": 152,
    "117500-119999": 146,
    "120000-122499": 252,
    "122500-124999": 792,
    "125000-127499": 400,
    "127500-129999": 274,
    "130000-132499": 149,
    "132500-134999": 335,
    "135000-137499": 195,
    "137500-139999": 84,
    "140000-142499": 81,
    "142500-144999": 25,
    "145000-147499": 32,
    "147500-149999": 111,
    "150000-152499": 25,
    "152500-154999": 98,
    "155000-157499": 38,
    "157500-159999": 50,
    "160000-162499": 20,
    "162500-164999": 33,
    "165000-167499": 52,
    "167500-169999": 27,
    "170000-172499": 31,
    "172500-174999": 35,
    "175000-177499": 82,
    "177500-179999": 26,
    "180000-182499": 7,
    "182500-184999": 2,
    "185000-187499": 4,
    "187500-189999": 1,
    "190000-192499": 4,
    "192500-194999": 6,
    "195000-197499": 2,
    "202500-204999": 4,
    "205000-207499": 11,
    "207500-209999": 14,
    "210000-212499": 12,
    "212500-214999": 2,
    "215000-217499": 1,
    "217500-219999": 1,
    "220000-222499": 1,
    "255000-257499": 1,
    "485000-487499": 1,
    "490000-492499": 1,
    "517500-519999": 1,
    "3245000-3247499": 1,
    "3515000-3517499": 1,
  },
  remove_liquidity: {
    "40000-42499": 10,
    "47500-49999": 3,
    "50000-52499": 4,
    "52500-54999": 8,
    "55000-57499": 3,
    "57500-59999": 6,
    "60000-62499": 33,
    "62500-64999": 3,
    "65000-67499": 3,
    "67500-69999": 24,
    "70000-72499": 21,
    "72500-74999": 3,
    "75000-77499": 2,
    "77500-79999": 22,
    "80000-82499": 21,
    "85000-87499": 165,
    "87500-89999": 21,
    "90000-92499": 8,
    "92500-94999": 35,
    "95000-97499": 139,
    "97500-99999": 5,
    "100000-102499": 12,
    "102500-104999": 281,
    "105000-107499": 54,
    "107500-109999": 63,
    "110000-112499": 43,
    "112500-114999": 219,
    "115000-117499": 93,
    "117500-119999": 38,
    "120000-122499": 202,
    "122500-124999": 25,
    "125000-127499": 23,
    "127500-129999": 74,
    "130000-132499": 4,
    "132500-134999": 10,
    "135000-137499": 38,
    "137500-139999": 2,
    "140000-142499": 12,
    "142500-144999": 68,
    "145000-147499": 26,
    "147500-149999": 2,
    "150000-152499": 4,
    "152500-154999": 30,
    "155000-157499": 8,
    "157500-159999": 10,
    "160000-162499": 2,
    "162500-164999": 6,
    "165000-167499": 1,
    "167500-169999": 2,
    "170000-172499": 43,
    "172500-174999": 3,
    "175000-177499": 7,
    "177500-179999": 2,
    "180000-182499": 4,
    "182500-184999": 12,
    "187500-189999": 7,
    "190000-192499": 1,
    "192500-194999": 6,
    "195000-197499": 8,
    "197500-199999": 3,
    "200000-202499": 16,
    "202500-204999": 1,
    "207500-209999": 7,
    "212500-214999": 6,
    "215000-217499": 19,
    "232500-234999": 1,
    "250000-252499": 2,
    "267500-269999": 1,
    "602500-604999": 1,
  },
};

// Define a type for your sandwich data for better type checking
type SandwichData = {
  [key: string]: string; // Adjust this based on the actual structure of your CSV
};

/**
 * Loads and parses the sandwiches-ng.csv file.
 * @returns A promise that resolves with the parsed sandwich data.
 */
async function loadSandwichDataFromCSVfile(): Promise<SandwichData[]> {
  return new Promise((resolve, reject) => {
    const sandwichData: SandwichData[] = [];
    const parser = createReadStream("../sandwiches-ng.csv").pipe(
      parse({
        columns: true, // Assumes the first row contains column headers
        skip_empty_lines: true,
      })
    );

    parser.on("data", (row: SandwichData) => {
      sandwichData.push(row);
    });

    parser.on("end", () => {
      resolve(sandwichData);
    });

    parser.on("error", (err) => {
      reject(err);
    });
  });
}

export async function getGasUsageFromCsvFile() {
  try {
    const data = await loadSandwichDataFromCSVfile();

    for (let item of data) {
      const txId = await getTxIdByTxHash(item.transactionHash);
      const gasUsed = await getGasUsedFromReceipt(item.transactionHash);
      const gasInUSD = await getTransactionCostInUSD(item.transactionHash);
      const unixtime = txId !== null ? await getUnixTimestampByTxId(txId) : null;
      const ethPrice = unixtime !== null ? await getEthPriceWithTimestampFromTable(unixtime) : null;
      const gasPriceInGwei = await getGasPriceInGwei(item.transactionHash);

      item.gasUsed = gasUsed !== null ? gasUsed.toString() : "N/A";
      item.gasInUSD = gasInUSD !== null ? gasInUSD.toString() : "N/A";
      item.ethPrice = ethPrice !== null ? ethPrice.toString() : "N/A";
      item.gasPriceInGwei = gasPriceInGwei !== null ? gasPriceInGwei.toString() : "N/A";
    }

    const csvWriter = createObjectCsvWriter({
      path: "updatedSandwichData.csv",
      header: [
        { id: "", title: "" },
        { id: "level_0", title: "LEVEL_0" },
        { id: "index", title: "INDEX" },
        { id: "tx_to", title: "TX_TO" },
        { id: "from", title: "FROM" },
        { id: "arb", title: "ARB" },
        { id: "i", title: "I" },
        { id: "j", title: "J" },
        { id: "dx", title: "DX" },
        { id: "dy", title: "DY" },
        { id: "min_dy", title: "MIN_DY" },
        { id: "transactionHash", title: "TRANSACTION_HASH" },
        { id: "blockNumber", title: "BLOCK_NUMBER" },
        { id: "pool.id", title: "POOL_ID" },
        { id: "max_value", title: "MAX_VALUE" },
        { id: "dy_no_fuckery", title: "DY_NO_FUCKERY" },
        { id: "slippage_amt", title: "SLIPPAGE_AMT" },
        { id: "extractable", title: "EXTRACTABLE" },
        { id: "extdec", title: "EXTDEC" },
        { id: "total_dynamic_fees", title: "TOTAL_DYNAMIC_FEES" },
        { id: "dynamic_revenue", title: "DYNAMIC_REVENUE" },
        { id: "dynamic_profits", title: "DYNAMIC_PROFITS" },
        { id: "total_fixed_fees", title: "TOTAL_FIXED_FEES" },
        { id: "fixed_revenue", title: "FIXED_REVENUE" },
        { id: "fixed_profits", title: "FIXED_PROFITS" },
        { id: "gasUsed", title: "GAS_USED" },
        { id: "gasInUSD", title: "GAS_IN_USD" },
        { id: "ethPrice", title: "ETH_PRICE_USD" },
        { id: "gasPriceInGwei", title: "GAS_PRICE_IN_GWEI" },
      ],
    });

    await csvWriter.writeRecords(data);
    console.log("Data was written to updatedSandwichData.csv successfully.");
  } catch (error) {
    console.error("Error updating data and writing CSV:", error);
  }
}
