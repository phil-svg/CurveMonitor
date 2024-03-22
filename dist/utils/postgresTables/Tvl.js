import { WEB3_HTTP_PROVIDER, web3Call } from "../web3Calls/generic.js";
import { getAbiBy } from "./Abi.js";
import { getTimestampByBlockNumber } from "./readFunctions/Blocks.js";
import { findCoinDecimalsById, getCoinIdByAddress } from "./readFunctions/Coins.js";
import { getCoinsBy, getNCoinsBy } from "./readFunctions/Pools.js";
import { getTokenPriceWithTimestampFromDb } from "./readFunctions/PriceMap.js";
async function estimateTimestampForBlock(blockNumber) {
    const knownBlockNumber = 19319792;
    const knownBlockTimestamp = 1709047775; // Unix timestamp for block 19319792
    const averageBlockTime = 12; // Average time per block in seconds
    const unixTimeOfBlock = await getTimestampByBlockNumber(blockNumber);
    if (unixTimeOfBlock) {
        return unixTimeOfBlock;
    }
    else {
        // Calculate the time difference based on block numbers
        const blockDifference = blockNumber - knownBlockNumber;
        const timeDifferenceInSeconds = blockDifference * averageBlockTime;
        // Estimate the Unix timestamp for the target block
        const estimatedTimestamp = knownBlockTimestamp + timeDifferenceInSeconds;
        return estimatedTimestamp;
    }
}
async function getPoolCoinBalanceFromChain(poolAddress, nCoins, blockNumber, poolCoins) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: poolAddress });
    if (!ABI) {
        console.log("Missing ABI for", poolAddress, " in getPoolCoinBalanceFromChain");
        return null;
    }
    const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI, poolAddress);
    let balances = [];
    for (let i = 0; i < nCoins; i++) {
        let balance = await web3Call(CONTRACT, "balances", [i], blockNumber);
        if (!balance) {
            console.log("Failed to fetch balance for", poolAddress, "in getPoolCoinBalanceFromChain");
            balance = 0;
        }
        const coinIdInDb = await getCoinIdByAddress(poolCoins[i]);
        if (!coinIdInDb) {
            console.log("Failed to fetch coinIdInDb for", poolAddress, poolCoins[i], "in getPoolCoinBalanceFromChain");
            return null;
        }
        const coinDecimals = await findCoinDecimalsById(coinIdInDb);
        if (!coinDecimals) {
            console.log("Failed to fetch coinDecimals for", poolAddress, poolCoins[i], "in getPoolCoinBalanceFromChain");
            return [];
        }
        balances.push(balance / 10 ** coinDecimals);
    }
    return balances;
}
async function translateBalanceIntoTvl(poolAddress, nCoins, blockNumber, poolCoins, poolBalances) {
    const unixTimeOfBlock = await estimateTimestampForBlock(blockNumber);
    let tvl = 0;
    for (let i = 0; i < nCoins; i++) {
        if (poolBalances[i] === 0)
            continue;
        const coinIdInDb = await getCoinIdByAddress(poolCoins[i]);
        if (!coinIdInDb) {
            console.log("Failed to fetch coinIdInDb for", poolAddress, poolCoins[i], "in getPoolCoinBalanceFromChain");
            return null;
        }
        let coinPriceUSD = await getTokenPriceWithTimestampFromDb(coinIdInDb, unixTimeOfBlock);
        // used for a one-time fetch.
        if (poolCoins[i] === "0x96E61422b6A9bA0e068B6c5ADd4fFaBC6a4aae27")
            coinPriceUSD = 1.008;
        if (poolCoins[i] === "0xD71eCFF9342A5Ced620049e616c5035F1dB98620")
            coinPriceUSD = 1.078;
        if (poolCoins[i] === "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490")
            coinPriceUSD = 1.03;
        if (poolCoins[i] === "0xF0a93d4994B3d98Fb5e3A2F90dBc2d69073Cb86b")
            coinPriceUSD = 0;
        if (poolCoins[i] === "0x64351fC9810aDAd17A690E4e1717Df5e7e085160")
            coinPriceUSD = 3242;
        if (poolCoins[i] === "0x1BEf2e5DE862034Fb0ed456DF59d29Ecadc9934C")
            coinPriceUSD = 0;
        if (poolCoins[i] === "0x31d4Eb09a216e181eC8a43ce79226A487D6F0BA9")
            coinPriceUSD = 0.05;
        if (poolCoins[i] === "0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309")
            coinPriceUSD = 0;
        if (poolCoins[i] === "0x0F83287FF768D1c1e17a42F44d644D7F22e8ee1d")
            coinPriceUSD = 0;
        if (poolCoins[i] === "0x2Fc6e9c1b2C07E18632eFE51879415a580AD22E1")
            coinPriceUSD = 0.184;
        if (poolCoins[i] === "0x183395DbD0B5e93323a7286D1973150697FFFCB3")
            coinPriceUSD = 119.95;
        if (poolCoins[i] === "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3")
            coinPriceUSD = 3232;
        if (poolCoins[i] === "0x1BED97CBC3c24A4fb5C069C6E311a967386131f7")
            coinPriceUSD = 3200;
        if (poolCoins[i] === "0xA35b1B31Ce002FBF2058D22F30f95D405200A15b")
            coinPriceUSD = 3204;
        if (poolCoins[i] === "0x83F20F44975D03b1b09e64809B757c47f942BEeA")
            coinPriceUSD = 1.054;
        if (poolCoins[i] === "0xEE586e7Eaad39207F0549BC65f19e336942C992f")
            coinPriceUSD = 1.1;
        if (poolCoins[i] === "0x66eFF5221ca926636224650Fd3B9c497FF828F7D")
            coinPriceUSD = 56861;
        if (poolCoins[i] === "0xa2847348b58CEd0cA58d23c7e9106A49f1427Df6")
            coinPriceUSD = 1.39;
        if (poolCoins[i] === "0xc7D9c108D4E1dD1484D3e2568d7f74bfD763d356")
            coinPriceUSD = 0.7611;
        if (poolCoins[i] === "0x956F47F50A910163D8BF957Cf5846D573E7f87CA")
            coinPriceUSD = 0.9407;
        if (poolCoins[i] === "0xb8b295df2cd735b15BE5Eb419517Aa626fc43cD5")
            coinPriceUSD = 19.16;
        if (poolCoins[i] === "0x530824DA86689C9C17CdC2871Ff29B058345b44a")
            coinPriceUSD = 1.019;
        if (poolCoins[i] === "0xd7C9F0e536dC865Ae858b0C0453Fe76D13c3bEAc")
            coinPriceUSD = 0.9949;
        if (poolCoins[i] === "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab")
            coinPriceUSD = 0.9857;
        if (poolCoins[i] === "0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C")
            coinPriceUSD = 1.002;
        if (poolCoins[i] === "0x5Ca135cB8527d76e932f34B5145575F9d8cbE08E")
            coinPriceUSD = 1.11;
        if (!coinPriceUSD && coinPriceUSD !== 0) {
            console.log("Failed to fetch coinPriceUSD for", poolAddress, poolCoins[i], "in getPoolCoinBalanceFromChain");
            coinPriceUSD = 0;
        }
        tvl += coinPriceUSD * poolBalances[i];
    }
    return tvl;
}
export async function getTvlForPoolArrFromChain(poolAddresses, blockNumber) {
    let combinedTvl = 0;
    let counter = 0;
    for (const poolAddress of poolAddresses) {
        counter++;
        console.log("\n", counter, poolAddresses.length);
        const tvl = await getPoolTvlInUsdFromChain(poolAddress, blockNumber);
        if (tvl) {
            combinedTvl += tvl;
            console.log("combinedTvl", combinedTvl);
        }
    }
    console.log("combinedTvl", combinedTvl);
    return combinedTvl;
}
export async function getPoolTvlInUsdFromChain(poolAddress, blockNumber) {
    const nCoins = await getNCoinsBy({ address: poolAddress });
    if (!nCoins) {
        console.log("Failed to fetch nCoins for", poolAddress, "in getPoolCoinBalanceFromChain");
        return null;
    }
    const poolCoins = await getCoinsBy({ address: poolAddress });
    if (!poolCoins) {
        console.log("Failed to fetch poolCoins for", poolAddress, "in getPoolCoinBalanceFromChain");
        return null;
    }
    const poolBalances = await getPoolCoinBalanceFromChain(poolAddress, nCoins, blockNumber, poolCoins);
    if (!poolBalances) {
        console.log("Failed to fetch poolBalances for", poolAddress, "in getPoolCoinBalanceFromChain");
        return null;
    }
    console.log("poolBalances", poolBalances);
    const tvl = await translateBalanceIntoTvl(poolAddress, nCoins, blockNumber, poolCoins, poolBalances);
    console.log("tvl", Number(tvl === null || tvl === void 0 ? void 0 : tvl.toFixed(0)));
    return tvl;
}
//# sourceMappingURL=Tvl.js.map