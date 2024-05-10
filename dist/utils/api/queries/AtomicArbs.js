import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { getTimeframeTimestamp } from '../utils/Timeframes.js';
import { Transactions } from '../../../models/Transactions.js';
import { AtomicArbs } from '../../../models/AtomicArbs.js';
import { getPoolIdByPoolAddress, } from '../../postgresTables/readFunctions/Pools.js';
export async function getTotalNumberOfAtomicArbsForDuration(timeDuration) {
    const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    const query = `
    SELECT COUNT(*) AS total
    FROM atomic_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.is_atomic_arb = true
  `;
    const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        raw: false,
        replacements: {
            timeframeStartUnix,
        },
    });
    const totalCount = result[0].total;
    return totalCount;
}
export async function getNumberOfAtomicArbsForPoolAndDuration(poolAddress, timeDuration) {
    const timeframeStartUnix = getTimeframeTimestamp(timeDuration);
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    const query = `
    SELECT COUNT(*) AS total
    FROM atomic_arbs a
    JOIN transactions t ON a.tx_id = t.tx_id
    WHERE t.block_unixtime >= :timeframeStartUnix
    AND a.is_atomic_arb = true
    AND t.pool_id = :poolId
  `;
    const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        raw: false,
        replacements: {
            timeframeStartUnix,
            poolId,
        },
    });
    const totalCount = result[0].total;
    return totalCount;
}
export async function getAtomicArbsForDuration(duration, page) {
    const recordsPerPage = 10;
    const offset = (page - 1) * recordsPerPage;
    const timeframeStartUnix = getTimeframeTimestamp(duration);
    const atomicArbs = await AtomicArbs.findAll({
        include: [
            {
                model: Transactions,
                as: 'transaction',
                where: {
                    block_unixtime: {
                        [Op.gte]: timeframeStartUnix,
                    },
                },
                required: true,
            },
        ],
        where: {
            is_atomic_arb: true,
        },
        limit: recordsPerPage,
        offset: offset,
        order: [['transaction', 'block_unixtime', 'DESC']],
    });
    const enrichedAtomicArbs = atomicArbs.map((arb) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const transaction = arb.transaction.toJSON();
        return Object.assign(Object.assign({}, transaction), { tx_id: (_a = transaction.tx_id) !== null && _a !== void 0 ? _a : 0, pool_id: (_b = transaction.pool_id) !== null && _b !== void 0 ? _b : 0, event_id: (_c = transaction.event_id) !== null && _c !== void 0 ? _c : null, tx_hash: (_d = transaction.tx_hash) !== null && _d !== void 0 ? _d : '', block_number: (_e = transaction.block_number) !== null && _e !== void 0 ? _e : 0, block_unixtime: (_f = transaction.block_unixtime) !== null && _f !== void 0 ? _f : 0, transaction_type: (_g = transaction.transaction_type) !== null && _g !== void 0 ? _g : '', trader: (_h = transaction.trader) !== null && _h !== void 0 ? _h : '', tx_position: (_j = transaction.tx_position) !== null && _j !== void 0 ? _j : 0, raw_fees: (_k = transaction.raw_fees) !== null && _k !== void 0 ? _k : null, fee_usd: (_l = transaction.fee_usd) !== null && _l !== void 0 ? _l : null, value_usd: (_m = transaction.value_usd) !== null && _m !== void 0 ? _m : null, revenue: arb.revenue !== null ? parseFloat(arb.revenue) : null, gasInUsd: arb.gas_in_usd !== null ? parseFloat(arb.gas_in_usd) : 0, gasInGwei: arb.gas_in_gwei !== null ? parseFloat(arb.gas_in_gwei) : null, netWin: arb.net_win !== null ? parseFloat(arb.net_win) : null, bribe: arb.bribe !== null ? parseFloat(arb.bribe) : null, totalCost: arb.total_cost !== null ? parseFloat(arb.total_cost) : null, blockBuilder: (_o = arb.block_builder) !== null && _o !== void 0 ? _o : null, validatorPayOffUSD: arb.block_payout_to_validator !== null ? parseFloat(arb.block_payout_to_validator) : null });
    });
    return enrichedAtomicArbs;
}
export async function getAtomicArbsForPoolAndDuration(poolAddress, duration, page) {
    const recordsPerPage = 10;
    const offset = (page - 1) * recordsPerPage;
    const timeframeStartUnix = getTimeframeTimestamp(duration);
    const poolId = await getPoolIdByPoolAddress(poolAddress);
    const atomicArbs = await AtomicArbs.findAll({
        include: [
            {
                model: Transactions,
                as: 'transaction',
                where: {
                    block_unixtime: {
                        [Op.gte]: timeframeStartUnix,
                    },
                    pool_id: poolId,
                },
                required: true,
            },
        ],
        where: {
            is_atomic_arb: true,
        },
        limit: recordsPerPage,
        offset: offset,
        order: [['transaction', 'block_unixtime', 'DESC']],
    });
    const enrichedAtomicArbs = atomicArbs.map((arb) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const transaction = arb.transaction.toJSON();
        return Object.assign(Object.assign({}, transaction), { tx_id: (_a = transaction.tx_id) !== null && _a !== void 0 ? _a : 0, pool_id: (_b = transaction.pool_id) !== null && _b !== void 0 ? _b : 0, event_id: (_c = transaction.event_id) !== null && _c !== void 0 ? _c : null, tx_hash: (_d = transaction.tx_hash) !== null && _d !== void 0 ? _d : '', block_number: (_e = transaction.block_number) !== null && _e !== void 0 ? _e : 0, block_unixtime: (_f = transaction.block_unixtime) !== null && _f !== void 0 ? _f : 0, transaction_type: (_g = transaction.transaction_type) !== null && _g !== void 0 ? _g : '', trader: (_h = transaction.trader) !== null && _h !== void 0 ? _h : '', tx_position: (_j = transaction.tx_position) !== null && _j !== void 0 ? _j : 0, raw_fees: (_k = transaction.raw_fees) !== null && _k !== void 0 ? _k : null, fee_usd: (_l = transaction.fee_usd) !== null && _l !== void 0 ? _l : null, value_usd: (_m = transaction.value_usd) !== null && _m !== void 0 ? _m : null, revenue: arb.revenue !== null ? parseFloat(arb.revenue) : null, gasInUsd: arb.gas_in_usd !== null ? parseFloat(arb.gas_in_usd) : 0, gasInGwei: arb.gas_in_gwei !== null ? parseFloat(arb.gas_in_gwei) : null, netWin: arb.net_win !== null ? parseFloat(arb.net_win) : null, bribe: arb.bribe !== null ? parseFloat(arb.bribe) : null, totalCost: arb.total_cost !== null ? parseFloat(arb.total_cost) : null, blockBuilder: (_o = arb.block_builder) !== null && _o !== void 0 ? _o : null, validatorPayOffUSD: arb.block_payout_to_validator !== null ? parseFloat(arb.block_payout_to_validator) : null });
    });
    return enrichedAtomicArbs;
}
export async function getFullAtomicArbTable(duration, page) {
    const totalNumberOfAtomicArbs = await getTotalNumberOfAtomicArbsForDuration(duration);
    const atomicArbs = await getAtomicArbsForDuration(duration, page);
    return { data: atomicArbs, totalNumberOfAtomicArbs };
}
export async function getPoolSpecificAtomicArbTable(poolAddress, duration, page) {
    const totalNumberOfAtomicArbs = await getNumberOfAtomicArbsForPoolAndDuration(poolAddress, duration);
    const atomicArbs = await getAtomicArbsForPoolAndDuration(poolAddress, duration, page);
    return { data: atomicArbs, totalNumberOfAtomicArbs };
}
//# sourceMappingURL=AtomicArbs.js.map