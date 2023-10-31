import { TransactionDetailsForAtomicArbs } from "../../../../Interfaces.js";
import { getContractByPoolID } from "../../../../helperFunctions/Web3.js";
import { web3Call } from "../../../../web3Calls/generic.js";
import { getEntireEventById, getEventById } from "../../../readFunctions/RawLogs.js";
import { getTransactionTypeByEventId } from "../../../readFunctions/Transactions.js";
import { txDetailEnrichment } from "../../../readFunctions/TxDetailEnrichment.js";

export async function solveSpotPriceUpdate(atomicArbDetails: TransactionDetailsForAtomicArbs): Promise<any | null> {
  const blockNumber = atomicArbDetails.block_number;

  const poolContract = await getContractByPoolID(atomicArbDetails.pool_id);
  if (!poolContract) return null;

  const parsedTx = await txDetailEnrichment(atomicArbDetails.tx_id);
  if (!parsedTx) return null;
  console.log("parsedTx", parsedTx);

  const event = await getEntireEventById(atomicArbDetails.event_id!);
  const returnValues = event.dataValues.returnValues;
  // console.log("returnValues", returnValues);

  const eventType = await getTransactionTypeByEventId(atomicArbDetails.event_id!);
  console.log("eventType", eventType);

  let eventName = await getEventById(atomicArbDetails.event_id!);
  console.log("eventName", eventName);

  // exchange
  // exchange_underlying
  // deposit
  // remove

  // step 1:
  // try to just recreate the swap of the current example tx

  if (eventName === "TokenExchange") {
    const from = returnValues.sold_id;
    const to = returnValues.bought_id;
    const amountToSell = returnValues.tokens_sold;
    const dy = await web3Call(poolContract, "get_dy", [from, to, amountToSell], blockNumber + 1);
    console.log("dy", dy);
  }

  if (eventName === "TokenExchangeUnderlying") {
    //
  }

  return "lol";
}
