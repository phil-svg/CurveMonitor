import { ExtendedTransactionData, SandwichLoss } from "../../../Interfaces.js";
import { getContractByPoolID } from "../../../helperFunctions/Web3.js";
import { web3Call } from "../../../web3Calls/generic.js";
import { findCoinAddressById, findCoinDecimalsById, findCoinSymbolById, getLpTokenIdByPoolId } from "../../readFunctions/Coins.js";
import { getCoinPositionInPoolByCoinId, getVersionBy } from "../../readFunctions/Pools.js";
import { getEventById, getReturnValuesByEventId } from "../../readFunctions/RawLogs.js";
import { findMatchingTokenTransferAmout, requiresDepositParam } from "./SandwichUtils.js";

export async function calculateLossForSwap(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  if (!parsedTx.event_id) return null;
  let event = await getEventById(parsedTx.event_id);
  if (event === "TokenExchange") return await calculateLossForExchange(parsedTx);
  if (event === "TokenExchangeUnderlying") return await calculateLossForExchangeUnderlying(parsedTx);
  return null;
}

export async function calculateLossForExchange(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  const inCoin = parsedTx.transactionCoins.find((coin) => coin.direction === "in");

  if (!inCoin) return null;
  const coinID = inCoin.coin_id;
  const coinSymbol = inCoin.coin_symbol;

  const amountUnhappyUser = Number(inCoin.amount);

  const POOL_CONTRACT = await getContractByPoolID(parsedTx.pool_id);
  const RAW_EVENT_RETURN_VALUES = await getReturnValuesByEventId(parsedTx.event_id!);

  if (!POOL_CONTRACT || !RAW_EVENT_RETURN_VALUES) return null;

  const { sold_id: FROM, bought_id: TO, tokens_sold: AMOUNT_IN } = RAW_EVENT_RETURN_VALUES;
  const BLOCK = parsedTx.block_number - 1;

  try {
    let amountHappyUserNotDecimalAdjusted = await web3Call(POOL_CONTRACT, "get_dy", [FROM, TO, AMOUNT_IN], BLOCK);
    const COIN_DECIMALS = await findCoinDecimalsById(coinID);

    if (!COIN_DECIMALS) return null;

    let amountHappyUser = amountHappyUserNotDecimalAdjusted / 10 ** COIN_DECIMALS;

    const LOSS_AMOUNT = amountHappyUser - amountUnhappyUser;

    const unitAddress = await findCoinAddressById(coinID);
    if (!unitAddress) return null;

    return {
      amount: LOSS_AMOUNT,
      unit: coinSymbol!,
      unitAddress: unitAddress,
      lossInPercentage: (LOSS_AMOUNT / amountHappyUser) * 100,
    };
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function calculateLossForExchangeUnderlying(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  const inCoin = parsedTx.transactionCoins.find((coin) => coin.direction === "in");

  if (!inCoin) return null;
  const coinID = inCoin.coin_id;
  const coinSymbol = inCoin.coin_symbol;

  const outCoin = parsedTx.transactionCoins.find((coin) => coin.direction === "out");
  if (!outCoin) return null;
  const roundedAmount = outCoin.amount;
  if (!roundedAmount) return null;
  const coinInDecimals = await findCoinDecimalsById(outCoin.coin_id);

  const amountUnhappyUser = Number(inCoin.amount);

  const POOL_CONTRACT = await getContractByPoolID(parsedTx.pool_id);
  const RAW_EVENT_RETURN_VALUES = await getReturnValuesByEventId(parsedTx.event_id!);

  if (!POOL_CONTRACT || !RAW_EVENT_RETURN_VALUES) return null;

  console.log("outCoin", outCoin, "coinInDecimals", coinInDecimals);

  const { sold_id: FROM, bought_id: TO } = RAW_EVENT_RETURN_VALUES;
  const AMOUNT_IN = BigInt(roundedAmount.split(".")[0] + roundedAmount.split(".")[1].slice(0, coinInDecimals!)).toString();
  const BLOCK = parsedTx.block_number - 1;

  try {
    let amountHappyUserNotDecimalAdjusted = await web3Call(POOL_CONTRACT, "get_dy_underlying", [FROM, TO, AMOUNT_IN], BLOCK);
    const COIN_DECIMALS = await findCoinDecimalsById(coinID);

    if (!COIN_DECIMALS) return null;

    let amountHappyUser = amountHappyUserNotDecimalAdjusted / 10 ** COIN_DECIMALS;

    const LOSS_AMOUNT = amountHappyUser - amountUnhappyUser;

    const unitAddress = await findCoinAddressById(coinID);
    if (!unitAddress) return null;

    return {
      amount: LOSS_AMOUNT,
      unit: coinSymbol!,
      unitAddress: unitAddress,
      lossInPercentage: (LOSS_AMOUNT / amountHappyUser) * 100,
    };
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function calculateLossForDeposit(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  const coinID = await getLpTokenIdByPoolId(parsedTx.pool_id);
  const coinSymbol = await findCoinSymbolById(coinID!);

  const POOL_CONTRACT = await getContractByPoolID(parsedTx.pool_id);
  const RAW_EVENT_RETURN_VALUES = await getReturnValuesByEventId(parsedTx.event_id!);

  if (!POOL_CONTRACT || !RAW_EVENT_RETURN_VALUES) return null;

  const AMOUNTS = RAW_EVENT_RETURN_VALUES.token_amounts;
  const BLOCK = parsedTx.block_number - 1;

  const NEEDS_DEPOSIT_BOOLEAN = await requiresDepositParam(parsedTx.pool_id);

  try {
    let amountHappyUserNotDecimalAdjusted;
    if (NEEDS_DEPOSIT_BOOLEAN) {
      amountHappyUserNotDecimalAdjusted = await web3Call(POOL_CONTRACT, "calc_token_amount", [AMOUNTS, true], BLOCK);
    } else {
      amountHappyUserNotDecimalAdjusted = await web3Call(POOL_CONTRACT, "calc_token_amount", [AMOUNTS], BLOCK);
    }
    const COIN_DECIMALS = await findCoinDecimalsById(coinID!);

    if (!COIN_DECIMALS) return null;

    let amountHappyUser = amountHappyUserNotDecimalAdjusted / 10 ** COIN_DECIMALS;
    let amountUnhappyUser = await findMatchingTokenTransferAmout(coinID!, parsedTx, amountHappyUser);
    if (!amountUnhappyUser) return null;

    const LOSS_AMOUNT = amountHappyUser - amountUnhappyUser;

    const unitAddress = await findCoinAddressById(coinID!);
    if (!unitAddress) return null;

    return {
      amount: LOSS_AMOUNT,
      unit: coinSymbol!,
      unitAddress: unitAddress,
      lossInPercentage: (LOSS_AMOUNT / amountHappyUser) * 100,
    };
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function calculateLossForWithdraw(parsedTx: ExtendedTransactionData): Promise<SandwichLoss | null> {
  const outCoin = parsedTx.transactionCoins.find((coin) => coin.direction === "out");
  if (!outCoin) return null;

  const coinID = outCoin.coin_id;
  const coinSymbol = outCoin.coin_symbol;

  const POOL_CONTRACT = await getContractByPoolID(parsedTx.pool_id);

  const RAW_EVENT_RETURN_VALUES = await getReturnValuesByEventId(parsedTx.event_id!);

  if (!POOL_CONTRACT || !RAW_EVENT_RETURN_VALUES) return null;

  const AMOUNT = RAW_EVENT_RETURN_VALUES.token_amount;
  const BLOCK = parsedTx.block_number - 1;

  let i = await getCoinPositionInPoolByCoinId(parsedTx.pool_id, coinID);

  try {
    let amountHappyUserNotDecimalAdjusted = await web3Call(POOL_CONTRACT, "calc_withdraw_one_coin", [AMOUNT, i], BLOCK);
    const COIN_DECIMALS = await findCoinDecimalsById(coinID!);

    if (!COIN_DECIMALS) return null;

    let amountHappyUser = amountHappyUserNotDecimalAdjusted / 10 ** COIN_DECIMALS;
    let amountUnhappyUser = Number(outCoin.amount);
    const LOSS_AMOUNT = amountHappyUser - amountUnhappyUser;

    const unitAddress = await findCoinAddressById(coinID!);
    if (!unitAddress) return null;

    return {
      amount: LOSS_AMOUNT,
      unit: coinSymbol!,
      unitAddress: unitAddress,
      lossInPercentage: (LOSS_AMOUNT / amountHappyUser) * 100,
    };
  } catch (err) {
    console.log(err);
    return null;
  }
}
