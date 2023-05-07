import { Pool } from '../../../models/Pools.js';
export const getIdByAddress = async (poolAddress) => {
    const pool = await Pool.findOne({ where: { address: poolAddress } });
    return pool ? pool.id : null;
};
export const getPoolBy = async (options) => {
    if (options.id) {
        return await Pool.findByPk(options.id);
    }
    else if (options.address) {
        return await Pool.findOne({ where: { address: options.address } });
    }
    else {
        throw new Error('You must provide either id or address');
    }
};
export const getAllPoolIds = async () => {
    const pools = await Pool.findAll();
    const poolIds = pools.map((pool) => pool.id);
    return poolIds;
};
export const getAllPoolAddresses = async () => {
    const pools = await Pool.findAll();
    const poolAddresses = pools.map((pool) => pool.address);
    return poolAddresses;
};
export const getAddressById = async (id) => {
    var _a;
    const pool = await Pool.findByPk(id);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.address) !== null && _a !== void 0 ? _a : null;
};
export const getV1PoolAddresses = async () => {
    const pools = await Pool.findAll({ where: { version: "v1" } });
    const poolAddresses = pools.map((pool) => pool.address);
    return poolAddresses;
};
export const getV2PoolAddresses = async () => {
    const pools = await Pool.findAll({ where: { version: "v2" } });
    const poolAddresses = pools.map((pool) => pool.address);
    return poolAddresses;
};
export const getNameBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.name) !== null && _a !== void 0 ? _a : null;
};
export const getNCoinsBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.n_coins) !== null && _a !== void 0 ? _a : null;
};
export const getCoinsBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.coins) !== null && _a !== void 0 ? _a : null;
};
export const getLpTokenBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.lp_token) !== null && _a !== void 0 ? _a : null;
};
export const getVersionBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.version) !== null && _a !== void 0 ? _a : null;
};
export const getBasePoolBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.base_pool) !== null && _a !== void 0 ? _a : null;
};
export const getSourceAddressBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.source_address) !== null && _a !== void 0 ? _a : null;
};
export const getInceptionBlockBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.inception_block) !== null && _a !== void 0 ? _a : null;
};
export const getCreationTimestampBy = async (options) => {
    var _a;
    const pool = await getPoolBy(options);
    return (_a = pool === null || pool === void 0 ? void 0 : pool.creation_timestamp) !== null && _a !== void 0 ? _a : null;
};
//# sourceMappingURL=Pools.js.map