import { getContractByPoolID } from "../../../../helperFunctions/Web3.js";
import { web3Call } from "../../../../web3Calls/generic.js";
import { findCoinDecimalsById } from "../../../readFunctions/Coins.js";
import { getEntireEventById, getEventById } from "../../../readFunctions/RawLogs.js";
import { getAllTxIdsByTxHash, getEventIdByTxId, getPoolIdByTxId, getTransactionTypeByEventId } from "../../../readFunctions/Transactions.js";
import { txDetailEnrichment } from "../../../readFunctions/TxDetailEnrichment.js";
import { getHistoricalTokenPriceFromDefiLlama } from "../../txValue/DefiLlama.js";
export async function solveSpotPriceUpdate(atomicArbDetails) {
    const blockNumber = atomicArbDetails.block_number;
    const allTxIdsForTxHash = await getAllTxIdsByTxHash(atomicArbDetails.tx_hash);
    // console.log("allTxIdsForTxHash", allTxIdsForTxHash);
    for (const txId of allTxIdsForTxHash) {
        await solveSpotPriceForSingleCase(txId, blockNumber);
    }
    return "";
}
function round(amount) {
    return Number(amount.toFixed(2));
}
async function solveSpotPriceForSingleCase(txId, blockNumber) {
    console.log("\nsolving market-loss for txId:", txId);
    const parsedTx = await txDetailEnrichment(txId);
    if (!parsedTx)
        return null;
    // console.log("parsedTx", parsedTx);
    const eventId = await getEventIdByTxId(txId);
    if (!eventId)
        return null;
    const event = await getEntireEventById(eventId);
    // console.log("event", event);
    const returnValues = event.dataValues.returnValues;
    // console.log("returnValues", returnValues);
    const poolId = await getPoolIdByTxId(txId);
    if (!poolId)
        return null;
    // const poolAddress = await getAddressById(poolId);
    // console.log("poolAddress", poolAddress);
    const poolContract = await getContractByPoolID(poolId);
    if (!poolContract)
        return null;
    const eventType = await getTransactionTypeByEventId(eventId); // swap & deposit & remove
    console.log("eventType", eventType);
    const eventName = await getEventById(eventId); // exchange | exchange_underlying | deposit | remove
    console.log("eventName", eventName);
    const boughtCoinInfo = parsedTx.coins_entering_wallet;
    // console.log("boughtCoinInfo", boughtCoinInfo);
    if (eventType === "swap") {
        const decimalsCoinBought = await findCoinDecimalsById(boughtCoinInfo[0].coin_id);
        if (!decimalsCoinBought)
            return null;
        const historicalPrice = await getHistoricalTokenPriceFromDefiLlama(boughtCoinInfo[0].address, parsedTx.block_unixtime);
        if (!historicalPrice)
            return null;
        console.log("historical price of", boughtCoinInfo[0].name, historicalPrice);
        if (eventName === "TokenExchange") {
            // example: 0xea2036963e98489a3fe1d56946e0105a5c93c4d381731079640b1ba8648df795
            const from = returnValues.sold_id;
            const to = returnValues.bought_id;
            const amountToSell = returnValues.tokens_sold;
            // state pre-arb
            const preArbDy = await web3Call(poolContract, "get_dy", [from, to, amountToSell], blockNumber - 1);
            const roundedPreArbDy = preArbDy / 10 ** decimalsCoinBought;
            const absolutDollarOutPreArb = round(roundedPreArbDy * historicalPrice);
            // state post-arb
            const postArbDy = await web3Call(poolContract, "get_dy", [from, to, amountToSell], blockNumber);
            const roundedPostArbDy = postArbDy / 10 ** decimalsCoinBought;
            const absolutDollarOutPostArb = round(roundedPostArbDy * historicalPrice);
            const dollarChangeInAbsTerms = round(absolutDollarOutPreArb - absolutDollarOutPostArb);
            console.log(`Dy changed from ${roundedPreArbDy} to ${roundedPostArbDy} ${boughtCoinInfo[0].name}`);
            console.log(`Dollars out changed from ${absolutDollarOutPreArb} to ${absolutDollarOutPostArb}`);
            console.log("dollarChangeInAbsTerms", dollarChangeInAbsTerms);
            //
        }
        else if (eventName === "TokenExchangeUnderlying") {
            const { sold_id: from, bought_id: to } = returnValues;
            const amountToSell = returnValues.tokens_sold;
            // state pre-arb
            const preArbDy = await web3Call(poolContract, "get_dy_underlying", [from, to, amountToSell], blockNumber - 1);
            const roundedPreArbDy = preArbDy / 10 ** decimalsCoinBought;
            // state post-arb
            const postArbDy = await web3Call(poolContract, "get_dy_underlying", [from, to, amountToSell], blockNumber);
            const roundedPostArbDy = postArbDy / 10 ** decimalsCoinBought;
            console.log(`Dy changed from ${roundedPreArbDy} to ${roundedPostArbDy} ${boughtCoinInfo[0].name}`);
        }
    }
    else if (eventType === "deposit") {
        //
    }
    else if (eventType === "remove") {
        // example: 0xb01cd8c3eb0756ff2f78a33728859bac900520824ae66055d1a9f35539bf1723
        //
    }
    else {
        return null;
    }
}
//# sourceMappingURL=SpotPriceAction.js.map