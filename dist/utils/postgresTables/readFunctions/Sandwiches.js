import { Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { Transactions } from "../../../models/Transactions.js";
import { getIdByAddress } from "./Pools.js";
export async function readSandwichesInBatches(batchSize = 100) {
    let offset = 0;
    const batches = [];
    while (true) {
        const sandwiches = await Sandwiches.findAll({
            where: {
                extracted_from_curve: true,
                source_of_loss_contract_address: null,
            },
            limit: batchSize,
            offset: offset,
        });
        if (sandwiches.length === 0) {
            break;
        }
        const transformedSandwiches = sandwiches.map((sandwich) => ({
            id: sandwich.id,
            loss_transactions: sandwich.loss_transactions,
        }));
        batches.push(transformedSandwiches);
        offset += batchSize;
    }
    return batches;
}
export async function readSandwichesInBatchesForBlock(blockNumber, batchSize = 100) {
    let offset = 0;
    const batches = [];
    while (true) {
        const sandwiches = await Sandwiches.findAll({
            where: {
                extracted_from_curve: true,
                source_of_loss_contract_address: null,
            },
            include: [
                {
                    model: Transactions,
                    as: "frontrunTransaction",
                    where: { block_number: blockNumber },
                    required: true,
                },
                {
                    model: Transactions,
                    as: "backrunTransaction",
                    where: { block_number: blockNumber },
                    required: true,
                },
            ],
            limit: batchSize,
            offset: offset,
        });
        if (sandwiches.length === 0) {
            break;
        }
        const transformedSandwiches = sandwiches.map((sandwich) => ({
            id: sandwich.id,
            loss_transactions: sandwich.loss_transactions,
        }));
        batches.push(transformedSandwiches);
        offset += batchSize;
    }
    return batches;
}
export async function findUniqueSourceOfLossAddresses() {
    const sandwiches = await Sandwiches.findAll({
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("source_of_loss_contract_address")), "source_of_loss_contract_address"]],
    });
    return sandwiches.map((sandwich) => sandwich.getDataValue("source_of_loss_contract_address"));
}
export async function getAllRawTableEntriesForPoolByPoolAddress(poolAddress) {
    let poolId = await getIdByAddress(poolAddress);
    return await getAllRawSandwichTableEntriesForPoolByPoolId(poolId);
}
export async function getAllRawSandwichTableEntriesForPoolByPoolId(poolId) {
    const poolRelatedSandwiches = await Sandwiches.findAll({ where: { pool_id: poolId } });
    return poolRelatedSandwiches;
}
export async function getExtractedSandwichesByPoolId(poolId) {
    const extractedSandwiches = await Sandwiches.findAll({
        where: {
            pool_id: poolId,
            extracted_from_curve: true,
        },
    });
    return extractedSandwiches;
}
export const isExtractedFromCurve = async (id) => {
    const sandwich = await Sandwiches.findByPk(id);
    return sandwich ? sandwich.extracted_from_curve : false;
};
//# sourceMappingURL=Sandwiches.js.map