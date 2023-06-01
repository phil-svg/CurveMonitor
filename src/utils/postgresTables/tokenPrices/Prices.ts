import { updateConsoleOutput } from "../../helperFunctions/QualityOfLifeStuff.js";
import { findCoinIdByAddress, findCoinSymbolById } from "../readFunctions/Coins.js";
import { getEarliestPoolInceptionByCoinId } from "../readFunctions/Pools.js";
import {
  countNullDollarValueForCoin,
  findAllFullyPricedCoinsIds,
  findAndModifySwapTransactions,
  getAllCoinIds,
  getAllUniqueSwapCounterPartCoinIds,
  getTotalEntriesForCoin,
} from "../readFunctions/TransactionCoins.js";
import { getFirstCoinAppearanceOnDefillama, getHistoricalPriceChart, getHistoricalPriceOnce } from "./DefillamaAPI.js";
import { extrapolateMultiple, getCoinIdsAboveThreshold, missingCounterUpdate, updateMostStableDollarCoinPrices } from "../../helperFunctions/Prices.js";

async function generalDebuggingInfo() {
  const ALL_COIN_IDS = await getAllCoinIds();
  let i = 0;
  for (const COIN_ID of ALL_COIN_IDS) {
    const COIN_SYMBOL = await findCoinSymbolById(COIN_ID);
    const nullDollarValueForCoin = await countNullDollarValueForCoin(COIN_ID);
    const totalEntriesForCoin = await getTotalEntriesForCoin(COIN_ID);
    if (nullDollarValueForCoin < 150) continue;
    console.log(`Coin: ${COIN_ID} (${COIN_SYMBOL}), ${nullDollarValueForCoin} of ${totalEntriesForCoin} price entries missing.`);
    i++;
  }
}

async function brainStormDefiLlama(): Promise<void> {
  let coinAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  let historicalPriceOnce = await getHistoricalPriceOnce(coinAddress, 1661212800);
  console.log("historicalPriceOnce", historicalPriceOnce);

  let id = await findCoinIdByAddress(coinAddress);
  let firstCoinApprearanceCurve = await getEarliestPoolInceptionByCoinId(id!);
  console.log("firstCoinApprearanceCurve", firstCoinApprearanceCurve);

  let historicalPriceChart = await getHistoricalPriceChart([coinAddress], 1548896409, 1000, "1d", "600");
  console.log("historicalPriceChart", historicalPriceChart, historicalPriceChart?.length);

  let firstCoinAppearanceOnDefillama = await getFirstCoinAppearanceOnDefillama(coinAddress);
  console.log("firstCoinAppearanceOnDefillama", firstCoinAppearanceOnDefillama);
}

async function initiateMostStableDollarCoin(): Promise<void> {
  const ADDRESS_MOST_STABLE_DOLLAR_COIN = process.env.ADDRESS_MOST_STABLE_DOLLAR_COIN;
  if (!ADDRESS_MOST_STABLE_DOLLAR_COIN) {
    console.log("Please provide ADDRESS_MOST_STABLE_DOLLAR_COIN in .env");
    return;
  }

  const COIN_ID_MOST_STABLE_DOLLAR_COIN = await findCoinIdByAddress(ADDRESS_MOST_STABLE_DOLLAR_COIN);
  if (!COIN_ID_MOST_STABLE_DOLLAR_COIN) return;

  await updateMostStableDollarCoinPrices(COIN_ID_MOST_STABLE_DOLLAR_COIN);
}

async function runBrachingWaves(): Promise<void> {
  let prevLength = 0;
  let waveCounter = 1;
  while (true) {
    const allPricedCoins = await findAllFullyPricedCoinsIds();
    if (allPricedCoins.length === prevLength) break;
    prevLength = allPricedCoins.length;
    console.log(`Running Wave ${waveCounter}`);
    waveCounter++;
    for (const pricedCoinId of allPricedCoins) {
      const uniqueSwapCounterPartCoinIds = await getAllUniqueSwapCounterPartCoinIds(pricedCoinId);
      const newSwapCounterPartCoinIds = uniqueSwapCounterPartCoinIds.filter((id) => !allPricedCoins.includes(id));
      for (const unpricedCoinId of newSwapCounterPartCoinIds) {
        await findAndModifySwapTransactions(pricedCoinId, unpricedCoinId);
      }
      const coinIdsAboveThreshold = await getCoinIdsAboveThreshold(pricedCoinId, newSwapCounterPartCoinIds);
      if (coinIdsAboveThreshold.length > 0) await extrapolateMultiple(coinIdsAboveThreshold);
    }
  }
}

async function treeBranching(): Promise<void> {
  await initiateMostStableDollarCoin();
  await runBrachingWaves();
}

export async function updateTokenDollarValues(): Promise<void> {
  await missingCounterUpdate();
  console.log("");

  await treeBranching();
  await generalDebuggingInfo();

  console.log("");
  await missingCounterUpdate();

  updateConsoleOutput("[✓] Prices solved successfully.\n");
}
