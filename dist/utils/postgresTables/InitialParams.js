// InitialParams.ts
/**
 * Loads into the database the params a pool started with.
 * Uses either the inception block, or in some cases the first block in which there was an event.
 */
import Web3 from "web3";
import { getAllPoolIds, getInceptionBlockBy, getAddressById, getVersionBy } from './readFunctions/Pools.js';
import { getAbiBy } from './Abi.js';
import { InitialParams } from '../../models/InitialParams.js';
import { getPastEvents } from "../web3Calls/generic.js";
if (!process.env.WEB3_HTTP) {
    console.error('Error: WEB3_WSS environment variable is not defined.');
    process.exit(1);
}
var WEB3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP));
async function getRelevantEventBlock(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK) {
    const CURRENT_BLOCK = await WEB3.eth.getBlockNumber();
    let range = 2000;
    const MAX_RANGE = 200000; // Maximum request range
    // This is a quick check if there had been any events at all that change the fee from being 0
    try {
        const CURRENT_FEE = await getFeeFromChain(POOL_ADDRESS, POOL_ABI, CURRENT_BLOCK);
        if (CURRENT_FEE === "0")
            return 0;
    }
    catch (error) {
        return 0; // some unused contracts have an execution reversion when asked for fee, but in this case it is always 0.
    }
    let prevUpperBlockNumber = INCEPTION_BLOCK;
    const CONTRACT = new WEB3.eth.Contract(POOL_ABI, POOL_ADDRESS);
    while (true) {
        console.log("Searching for the first Event for", POOL_ADDRESS);
        const lowerBound = prevUpperBlockNumber;
        const upperBound = Math.min(lowerBound + range, CURRENT_BLOCK);
        const EVENTS = await getPastEvents(CONTRACT, "allEvents", lowerBound, upperBound);
        if (EVENTS !== null && Array.isArray(EVENTS) && EVENTS.length > 0) {
            return EVENTS[EVENTS.length - 1].blockNumber;
        }
        else {
            range *= 10;
            if (range > MAX_RANGE) {
                range = MAX_RANGE;
            }
            prevUpperBlockNumber = upperBound;
        }
    }
}
async function saveA(poolId, A) {
    const initialParams = await InitialParams.findOne({ where: { pool_id: poolId } });
    if (initialParams) {
        await initialParams.update({ A: A });
    }
    else {
        await InitialParams.create({ pool_id: poolId, A: A });
    }
}
async function saveFee(poolId, fee) {
    const initialParams = await InitialParams.findOne({ where: { pool_id: poolId } });
    if (initialParams) {
        await initialParams.update({ fee: fee });
    }
    else {
        await InitialParams.create({ pool_id: poolId, fee: fee });
    }
}
async function saveGamma(poolId, gamma) {
    const initialParams = await InitialParams.findOne({ where: { pool_id: poolId } });
    if (initialParams) {
        await initialParams.update({ gamma: gamma });
    }
    else {
        await InitialParams.create({ pool_id: poolId, gamma: gamma });
    }
}
async function hasAEntry(poolId) {
    const entry = await InitialParams.findOne({ where: { pool_id: poolId } });
    return entry !== null && entry.A !== null && entry.A !== '';
}
async function hasFeeEntry(poolId) {
    const entry = await InitialParams.findOne({ where: { pool_id: poolId } });
    return entry !== null && entry.fee !== null && entry.fee !== '';
}
async function hasGammaEntry(poolId) {
    const entry = await InitialParams.findOne({ where: { pool_id: poolId } });
    return entry !== null && entry.gamma !== null && entry.gamma !== '';
}
async function getAFromChain(poolAddress, POOL_ABI, blockNumber) {
    const CONTRACT = new WEB3.eth.Contract(POOL_ABI, poolAddress);
    const A = await CONTRACT.methods.A().call(blockNumber);
    return A;
}
async function getFeeFromChain(poolAddress, POOL_ABI, blockNumber) {
    const CONTRACT = new WEB3.eth.Contract(POOL_ABI, poolAddress);
    const FEE = await CONTRACT.methods.fee().call(blockNumber);
    return FEE;
}
async function getGammaFromChain(poolAddress, POOL_ABI, blockNumber) {
    const CONTRACT = new WEB3.eth.Contract(POOL_ABI, poolAddress);
    const GAMMA = await CONTRACT.methods.A().call(blockNumber);
    return GAMMA;
}
async function handleVersion1(poolId, INCEPTION_BLOCK, POOL_ADDRESS, POOL_ABI) {
    if (!await hasAEntry(poolId)) {
        const A = await getAFromChain(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK);
        await saveA(poolId, A);
    }
    if (!await hasFeeEntry(poolId)) {
        const FEE = await getFeeFromChain(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK);
        await saveFee(poolId, FEE);
    }
}
async function handleVersion2(poolId, INCEPTION_BLOCK, POOL_ADDRESS, POOL_ABI) {
    if (!await hasAEntry(poolId)) {
        const A = await getAFromChain(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK);
        await saveA(poolId, A);
    }
    if (!await hasFeeEntry(poolId)) {
        const RELEVANT_BLOCK = await getRelevantEventBlock(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK);
        if (RELEVANT_BLOCK === 0) {
            await saveFee(poolId, "0");
        }
        else {
            const FEE = await getFeeFromChain(POOL_ADDRESS, POOL_ABI, RELEVANT_BLOCK);
            await saveFee(poolId, FEE);
        }
    }
    if (!await hasGammaEntry(poolId)) {
        const GAMMA = await getGammaFromChain(POOL_ADDRESS, POOL_ABI, INCEPTION_BLOCK);
        await saveGamma(poolId, GAMMA);
    }
}
async function solveInitParams(poolId) {
    const VERSION = await getVersionBy({ id: poolId });
    const INCEPTION_BLOCK = await getInceptionBlockBy({ id: poolId });
    if (!INCEPTION_BLOCK)
        return;
    const POOL_ADDRESS = await getAddressById(poolId);
    if (!POOL_ADDRESS)
        return;
    const POOL_ABI = await getAbiBy('AbisPools', { id: poolId });
    if (!POOL_ABI)
        return;
    if (VERSION === 'v1') {
        await handleVersion1(poolId, INCEPTION_BLOCK, POOL_ADDRESS, POOL_ABI);
    }
    else if (VERSION === 'v2') {
        await handleVersion2(poolId, INCEPTION_BLOCK, POOL_ADDRESS, POOL_ABI);
    }
}
export async function updateInitialPoolParams() {
    const ALL_POOL_IDS = (await getAllPoolIds()).sort((a, b) => a - b);
    for (const POOL_ID of ALL_POOL_IDS) {
        await solveInitParams(POOL_ID);
    }
    console.log(`[✓] Table: Param | Initial Parameters synced successfully.`);
}
//# sourceMappingURL=InitialParams.js.map