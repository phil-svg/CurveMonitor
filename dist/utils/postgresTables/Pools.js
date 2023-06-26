import Web3 from "web3";
import { getAbiBy } from "./Abi.js";
import { db } from "../../config/Database.js";
import { PoolCountFromProvider } from "../../models/PoolCountFromProvider.js";
import { Pool, PoolVersion } from "../../models/Pools.js";
import { Op } from "sequelize";
import { getProvidedAddress } from "../AddressProviderEntryPoint.js";
import eventEmitter from "../goingLive/EventEmitter.js";
if (!process.env.WEB3_WSS) {
    console.error("Error: WEB3_WSS environment variable is not defined.");
    process.exit(1);
}
const WEB3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS));
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_META_REGISTRY = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC";
/** *********************** Adding Pool-Addresses *********************** */
// double-checking to make sure a pool is listed only once in the postgres table 'pools'.
async function isAddressStoredInPools(address) {
    try {
        const pool = await db.models.Pool.findOne({
            where: {
                address: address,
            },
        });
        return pool !== null;
    }
    catch (error) {
        console.error(`Error checking if ${address} exists in the "pools" table: ${error}`);
        throw error;
    }
}
// creating a new entry in the postgres table 'pools', with address and source_address.
async function addAddressToPools(provider, address) {
    try {
        await db.models.Pool.create({
            address: address,
            source_address: provider,
        });
        console.log(`Address "${address}" added to the 'pools' table.`);
    }
    catch (error) {
        console.error(`Error adding ${address} to the "pools" table: ${error}`);
        throw error;
    }
}
// pool_count is stored per provider-address, and gets updated if there was a change.
async function upsertPoolCountFromProvider(address, count) {
    try {
        const [instance, created] = await PoolCountFromProvider.findOrCreate({
            where: { address },
            defaults: { count },
        });
        if (!created && instance.count !== count) {
            await instance.update({ count });
        }
    }
    catch (error) {
        console.error(`Error upserting pool count for provider address "${address}":`, error);
        throw error;
    }
}
// reads the pool_count which was used during the previous fetch, used as the new starting point to scan for updates.
async function getCountByAddress(address) {
    try {
        const poolCountFromProvider = await PoolCountFromProvider.findOne({
            where: { address },
        });
        if (poolCountFromProvider) {
            return poolCountFromProvider.count;
        }
        return 0;
    }
    catch (error) {
        console.error(`Error fetching count for address "${address}":`, error);
        throw error;
    }
}
// adds pool-addresses the postgres table 'pools'.
async function updatePoolTableForAddresses(address, poolCount) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error fetching ABI at updatePoolTableForAddresses for ${address}`);
        return;
    }
    const CONTRACT = new WEB3.eth.Contract(ABI, address);
    const PREV_MAX_COUNT = await getCountByAddress(address);
    for (let i = PREV_MAX_COUNT; i < poolCount; i++) {
        const POOL_ADDRESS = await CONTRACT.methods.pool_list(i).call();
        if (await isAddressStoredInPools(POOL_ADDRESS))
            continue;
        await addAddressToPools(address, POOL_ADDRESS);
    }
    await upsertPoolCountFromProvider(address, poolCount);
}
/** *********************** Adding LP-Token-Addresses *********************** */
async function hasGetLpToken(address) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error loading ABI at hasPoolCount.`);
        return null;
    }
    for (const FUNCTION of ABI) {
        if (FUNCTION.name === "get_lp_token")
            return true;
    }
    return false;
}
async function hasGetToken(address) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error loading ABI at hasPoolCount.`);
        return null;
    }
    for (const FUNCTION of ABI) {
        if (FUNCTION.name === "get_token")
            return true;
    }
    return false;
}
async function hasGetGauge(address) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error loading ABI at hasPoolCount.`);
        return null;
    }
    for (const FUNCTION of ABI) {
        if (FUNCTION.name === "get_gauge")
            return true;
    }
    return false;
}
async function getLpTokenAddress(poolAddress, sourceAddress) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: sourceAddress });
    if (!ABI) {
        console.log(`Error fetching ABI at updatePoolTableForAddresses for ${sourceAddress}`);
        return null;
    }
    const CONTRACT = new WEB3.eth.Contract(ABI, sourceAddress);
    if (await hasGetLpToken(sourceAddress)) {
        const LP_ADDRESS = await CONTRACT.methods.get_lp_token(poolAddress).call();
        return LP_ADDRESS;
    }
    else if (await hasGetToken(sourceAddress)) {
        const LP_ADDRESS = await CONTRACT.methods.get_token(poolAddress).call();
        return LP_ADDRESS;
    }
    else if (await hasGetGauge(sourceAddress)) {
        const GAUGE_ADDRESS = await CONTRACT.methods.get_gauge(poolAddress).call();
        if (GAUGE_ADDRESS === NULL_ADDRESS)
            return poolAddress;
        const ABI_LP_TOKEN = [
            {
                stateMutability: "view",
                type: "function",
                name: "lp_token",
                inputs: [],
                outputs: [
                    {
                        name: "",
                        type: "address",
                    },
                ],
            },
        ];
        const GAUGE_CONTRACT = new WEB3.eth.Contract(ABI_LP_TOKEN, GAUGE_ADDRESS);
        const LP_ADDRESS = await GAUGE_CONTRACT.methods.lp_token().call();
        return LP_ADDRESS;
    }
    return null;
}
async function updateLpTokenAddresses() {
    var _a;
    try {
        const poolsWithoutLpToken = await Pool.findAll({
            where: {
                lp_token: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const pool of poolsWithoutLpToken) {
            i += 1;
            const lpTokenAddress = await getLpTokenAddress(pool.address, (_a = pool.source_address) !== null && _a !== void 0 ? _a : "");
            pool.lp_token = lpTokenAddress;
            await pool.save();
        }
    }
    catch (error) {
        console.error("Error updating lp_token:", error);
        throw error;
    }
}
/** *********************** Adding Names *********************** */
async function getPoolNameFromLpToken(tokenAddress) {
    const ABI_NAME = [
        {
            stateMutability: "view",
            type: "function",
            name: "name",
            inputs: [],
            outputs: [
                {
                    name: "",
                    type: "string",
                },
            ],
        },
    ];
    const CONTRACT = new WEB3.eth.Contract(ABI_NAME, tokenAddress);
    const NAME = await CONTRACT.methods.name().call();
    return NAME;
}
async function updateNames() {
    try {
        const poolsWithoutNames = await Pool.findAll({
            where: {
                name: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const pool of poolsWithoutNames) {
            if (!pool.lp_token)
                continue;
            i += 1;
            const NAME = await getPoolNameFromLpToken(pool.lp_token);
            pool.name = NAME;
            await pool.save();
        }
    }
    catch (error) {
        console.error("Error updating names:", error);
        throw error;
    }
}
/** *********************** Adding Coins *********************** */
async function getCoins(poolAddress, sourceAddress) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: sourceAddress });
    if (!ABI) {
        console.log(`no ABI was found for ${sourceAddress}`);
        return null;
    }
    const CONTRACT = new WEB3.eth.Contract(ABI, sourceAddress);
    const COINS = await CONTRACT.methods.get_coins(poolAddress).call();
    return COINS.filter((value) => value !== "0x0000000000000000000000000000000000000000");
}
export async function updateCoins() {
    var _a;
    try {
        const poolsWithoutCoins = await Pool.findAll({
            where: {
                coins: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const pool of poolsWithoutCoins) {
            if (!pool.lp_token)
                continue;
            i += 1;
            const COINS = await getCoins(pool.address, (_a = pool.source_address) !== null && _a !== void 0 ? _a : "");
            pool.coins = COINS;
            await pool.save();
        }
    }
    catch (error) {
        console.error("Error updating coins:", error);
        throw error;
    }
}
/** *********************** Adding N_Coins *********************** */
async function getNCoins(poolAddress) {
    try {
        const pool = await Pool.findOne({
            where: { address: poolAddress },
        });
        if (pool && pool.coins) {
            return pool.coins.length;
        }
        return 0;
    }
    catch (error) {
        console.error(`Error fetching the number of coins for pool address "${poolAddress}":`, error);
        throw error;
    }
}
async function updateNCoins() {
    try {
        const poolsWithoutNCoins = await Pool.findAll({
            where: {
                n_coins: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const pool of poolsWithoutNCoins) {
            i += 1;
            const N_COINS = await getNCoins(pool.address);
            pool.n_coins = N_COINS;
            await pool.save();
        }
    }
    catch (error) {
        console.error("Error updating n_coins:", error);
        throw error;
    }
}
/** *********************** Adding Inception Block *********************** */
async function getInceptionBlock(highestBlock, poolAddress) {
    let lowestBlock = 0;
    while (lowestBlock <= highestBlock) {
        let searchBlock = Math.round((lowestBlock + highestBlock) / 2);
        let nonce = await WEB3.eth.getTransactionCount(poolAddress, searchBlock);
        if (nonce >= 1) {
            highestBlock = searchBlock;
        }
        else {
            lowestBlock = searchBlock;
        }
        if (highestBlock == lowestBlock + 1) {
            return highestBlock;
        }
    }
    return null;
}
async function updateInceptionBlock() {
    const HIGHEST_BLOCK = await WEB3.eth.getBlockNumber();
    try {
        const POOLS_WITHOUT_INCEPTION_BLOCK = await Pool.findAll({
            where: {
                inception_block: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const POOL of POOLS_WITHOUT_INCEPTION_BLOCK) {
            i += 1;
            const INCEPION_BLOCK = await getInceptionBlock(HIGHEST_BLOCK, POOL.address);
            if (!INCEPION_BLOCK)
                continue;
            POOL.inception_block = INCEPION_BLOCK;
            await POOL.save();
        }
    }
    catch (error) {
        console.error("Error updating inception_block:", error);
        throw error;
    }
}
/** *********************** Adding Creation Timestamp *********************** */
async function getCreationTimestamp(poolAddress) {
    const POOL = await Pool.findOne({
        where: { address: poolAddress },
    });
    if (!POOL) {
        return null;
    }
    const inceptionBlock = POOL.inception_block;
    if (inceptionBlock === undefined) {
        return null;
    }
    const BLOCK = await WEB3.eth.getBlock(inceptionBlock);
    return Number(BLOCK.timestamp);
}
async function updateCreationTimestamp() {
    try {
        const POOLS_WITHOUT_CREATION_TIMESTAMP = await Pool.findAll({
            where: {
                creation_timestamp: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const POOL of POOLS_WITHOUT_CREATION_TIMESTAMP) {
            i += 1;
            const CREATION_TIMESTAMP = await getCreationTimestamp(POOL.address);
            if (!CREATION_TIMESTAMP)
                continue;
            POOL.creation_timestamp = CREATION_TIMESTAMP;
            await POOL.save();
        }
    }
    catch (error) {
        console.error("Error updating creation_timestamp:", error);
        throw error;
    }
}
/** *********************** Adding Basepools *********************** */
async function getCoinsOfPoolFromDatabaseByPoolAddress(poolAddress) {
    const POOL = await Pool.findOne({
        where: { address: poolAddress },
    });
    if (!POOL) {
        return null;
    }
    const COINS = POOL.coins;
    if (COINS === undefined) {
        return null;
    }
    return COINS;
}
async function findPoolAddressByCoinLpToken(coins) {
    const poolWithMatchingLpToken = await Pool.findOne({
        where: {
            lp_token: {
                [Op.in]: coins,
            },
        },
    });
    return poolWithMatchingLpToken ? poolWithMatchingLpToken.address : NULL_ADDRESS;
}
async function updateBasepool() {
    try {
        const POOLS_WITHOUT_BASEPOOL = await Pool.findAll({
            where: {
                base_pool: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const POOL of POOLS_WITHOUT_BASEPOOL) {
            i += 1;
            const COINS = await getCoinsOfPoolFromDatabaseByPoolAddress(POOL.address);
            if (!COINS)
                return;
            const BASEPOOL = await findPoolAddressByCoinLpToken(COINS);
            if (!BASEPOOL)
                continue;
            POOL.base_pool = BASEPOOL;
            await POOL.save();
        }
    }
    catch (error) {
        console.error("Error updating base_pool:", error);
        throw error;
    }
}
/** *********************** Adding Versions *********************** */
async function getVersionForDatabase(poolAddress) {
    try {
        const ABI_GAMMA = [{ stateMutability: "view", type: "function", name: "gamma", inputs: [], outputs: [{ name: "", type: "uint256" }], gas: 11991 }];
        const CONTRACT = new WEB3.eth.Contract(ABI_GAMMA, poolAddress);
        await CONTRACT.methods.gamma().call();
        return PoolVersion.v2;
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("execution reverted")) {
            return PoolVersion.v1;
        }
        else {
            console.log(err);
            return null;
        }
    }
}
async function updateVersions() {
    try {
        const POOLS_WITHOUT_VERSIONS = await Pool.findAll({
            where: {
                version: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const POOL of POOLS_WITHOUT_VERSIONS) {
            i += 1;
            const VERSION = await getVersionForDatabase(POOL.address);
            if (!VERSION)
                continue;
            POOL.version = VERSION;
            await POOL.save();
        }
    }
    catch (error) {
        console.error("Error updating version:", error);
        throw error;
    }
}
/** *********************** Final *********************** */
async function hasPoolCount(address) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error loading ABI at hasPoolCount.`);
        return null;
    }
    for (const FUNCTION of ABI) {
        if (FUNCTION.name === "pool_count")
            return true;
    }
    return false;
}
async function getHasPoolCountContracts() {
    const PROVIDED_ADDRESSES = await getProvidedAddress();
    const POOL_COUNT_ADDRESSES = [];
    if (PROVIDED_ADDRESSES) {
        for (const ADDRESS of PROVIDED_ADDRESSES) {
            if (await hasPoolCount(ADDRESS)) {
                POOL_COUNT_ADDRESSES.push(ADDRESS);
            }
        }
        return POOL_COUNT_ADDRESSES;
    }
    else {
        console.log(`Error finding pool_count Contracts`);
        return null;
    }
}
async function getPoolCount(address) {
    const ABI = await getAbiBy("AbisRelatedToAddressProvider", { address: address });
    if (!ABI) {
        console.log(`Error loading ABI at getPoolCount.`);
        return null;
    }
    const CONTRACT = new WEB3.eth.Contract(ABI, address);
    const POOL_COUNT = await CONTRACT.methods.pool_count().call();
    return POOL_COUNT;
}
// goes through the address returned by the address provider. Finds Contracts which have pool-lists inside, and iterates over these lists.
// adds new pools to the table 'pools'
export async function updatePools() {
    const POOL_COUNT_CONTRACTS = await getHasPoolCountContracts();
    if (POOL_COUNT_CONTRACTS) {
        for (const ADDRESS of POOL_COUNT_CONTRACTS) {
            if (ADDRESS == ADDRESS_META_REGISTRY)
                continue;
            const POOL_COUNT = await getPoolCount(ADDRESS);
            if (POOL_COUNT) {
                await updatePoolTableForAddresses(ADDRESS, POOL_COUNT);
            }
        }
    }
    console.log("running updateLpTokenAddresses");
    await updateLpTokenAddresses();
    console.log("running updateNames");
    await updateNames();
    console.log("running updateCoins");
    await updateCoins();
    console.log("running updateNCoins");
    await updateNCoins();
    console.log("running updateInceptionBlock");
    await updateInceptionBlock();
    console.log("running updateCreationTimestamp");
    await updateCreationTimestamp();
    console.log("running updateBasepool");
    await updateBasepool();
    console.log("running updateVersions");
    await updateVersions();
    eventEmitter.emit("ready for new pool subscription");
    console.log(`[✓] Pools synced successfully.`);
}
//# sourceMappingURL=Pools.js.map