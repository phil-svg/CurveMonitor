import { saveTransaction, transactionExists } from "./ParsingHelper.js";
import { TransactionType } from "../../../models/Transactions.js";
import { getBlockTimeStamp, getTxReceipt } from "../../web3Calls/generic.js";
import { getCoinsBy } from "../readFunctions/Pools.js";
import { findCoinIdByAddress, findCoinDecimalsById } from "../readFunctions/Coins.js";
import { Transactions } from "../../../models/Transactions.js";
import { decodeTransferEventFromReceipt } from "../../helperFunctions/Web3.js";
import { copyFileSync } from "fs";

export async function parseAddLiquidity(event: any, BLOCK_UNIXTIME: any, POOL_COINS: any): Promise<void> {
  if (await transactionExists(event.eventId)) return;

  if (!POOL_COINS) return;
}
