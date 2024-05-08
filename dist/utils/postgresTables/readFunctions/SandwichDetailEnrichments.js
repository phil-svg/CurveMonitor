import { Sandwiches } from '../../../models/Sandwiches.js';
import { getModifiedPoolName } from '../../api/utils/SearchBar.js';
import { getLabelNameFromAddress } from './Labels.js';
import { getAddressById } from './Pools.js';
import { getLossInUsdForSandwich } from './Sandwiches.js';
import { txDetailEnrichment } from './TxDetailEnrichment.js';
export async function SandwichDetailEnrichment(id) {
    const sandwich = await Sandwiches.findOne({
        where: { id },
    });
    if (!sandwich)
        console.log('no sandwich');
    if (!sandwich)
        return null;
    const frontrunTransaction = await txDetailEnrichment(sandwich.frontrun);
    if (!frontrunTransaction)
        console.log('no frontrunTransaction');
    if (!frontrunTransaction)
        return null;
    const backrunTransaction = await txDetailEnrichment(sandwich.backrun);
    if (!backrunTransaction)
        console.log('no backrunTransaction');
    if (!backrunTransaction)
        return null;
    let centerTransactions = [];
    let userLossesDetails = [];
    if (sandwich.loss_transactions) {
        for (const lossTransaction of sandwich.loss_transactions) {
            const centerTransaction = await txDetailEnrichment(lossTransaction.tx_id);
            if (centerTransaction) {
                centerTransactions.push(centerTransaction);
            }
            userLossesDetails.push({
                unit: lossTransaction.unit,
                unitAddress: lossTransaction.unitAddress,
                amount: lossTransaction.amount,
                lossInPercentage: lossTransaction.lossInPercentage,
            });
        }
    }
    let label = await getLabelNameFromAddress(centerTransactions[0].called_contract_by_user);
    if (!label || label.startsWith('Contract Address')) {
        label = centerTransactions[0].called_contract_by_user;
    }
    let poolAddress = await getAddressById(frontrunTransaction.pool_id);
    let poolName = await getModifiedPoolName(poolAddress);
    const lossInUsd = await getLossInUsdForSandwich(id);
    const sandwichDetail = {
        frontrun: frontrunTransaction,
        center: centerTransactions,
        backrun: backrunTransaction,
        user_losses_details: userLossesDetails,
        label: label,
        poolAddress: poolAddress,
        poolName: poolName,
        lossInUsd: lossInUsd,
    };
    return sandwichDetail;
}
export async function enrichSandwiches(sandwichIds) {
    const enrichedSandwiches = await chunkedAsync(sandwichIds, 10, SandwichDetailEnrichment);
    const validSandwiches = enrichedSandwiches.filter((sandwich) => sandwich !== null);
    return validSandwiches;
}
export async function chunkedAsync(arr, concurrency, worker) {
    const results = [];
    const queue = arr.slice();
    while (queue.length > 0) {
        const tasks = queue.splice(0, concurrency).map((item) => worker(item).catch((e) => {
            // console.error(`Error processing item ${item}: ${e}`);
            return null;
        }));
        const newResults = await Promise.all(tasks);
        results.push(...newResults);
    }
    return results;
}
//# sourceMappingURL=SandwichDetailEnrichments.js.map