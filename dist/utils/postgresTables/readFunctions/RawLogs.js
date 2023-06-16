import { Op, fn, col, literal } from "sequelize";
import { RawTxLogs } from "../../../models/RawTxLogs.js";
import pkg from "lodash";
const { pick, isNaN } = pkg;
export async function getHighestStoredBlockForPoolId(poolId) {
    try {
        const highestBlock = await RawTxLogs.findOne({
            where: { pool_id: poolId },
            order: [["block_number", "DESC"]],
        });
        if (highestBlock) {
            return highestBlock.blockNumber;
        }
        else {
            return 0;
        }
    }
    catch (error) {
        console.error("Error retrieving the highest block number:", error);
        return 0;
    }
}
export async function getEntriesByBlockNumberAndPoolId(blockNumber, poolId) {
    try {
        const entries = await RawTxLogs.findAll({
            where: {
                block_number: blockNumber,
                pool_id: poolId,
            },
        });
        if (entries && entries.length > 0) {
            return entries;
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error("Error retrieving entries:", error);
        return null;
    }
}
export async function fetchDistinctBlockNumbers() {
    const distinctBlockNumbers = await RawTxLogs.findAll({
        attributes: [[fn("DISTINCT", col("block_number")), "block_number"]],
        order: [["block_number", "ASC"]],
    });
    return distinctBlockNumbers.map((row) => row.getDataValue("block_number"));
}
export async function fetchDistinctBlockNumbersInBatch(offset, batchSize) {
    const distinctBlockNumbers = await RawTxLogs.findAll({
        attributes: [[fn("DISTINCT", col("block_number")), "block_number"]],
        order: [["block_number", "ASC"]],
        offset: offset,
        limit: batchSize,
    });
    return distinctBlockNumbers.map((row) => row.getDataValue("block_number"));
}
export async function fetchEventsForBlockNumberRange(startBlock, endBlock) {
    const events = await RawTxLogs.findAll({
        where: {
            block_number: {
                [Op.gte]: startBlock,
                [Op.lte]: endBlock,
            },
        },
        order: [["block_number", "ASC"]],
    });
    return events.map((event) => {
        const plainEvent = event.get();
        const returnValues = Object.fromEntries(Object.entries(plainEvent.returnValues).filter(([key]) => isNaN(Number(key))));
        return pick(Object.assign(Object.assign({}, plainEvent), { returnValues }), [
            "eventId",
            "pool_id",
            "address",
            "blockNumber",
            "transactionHash",
            "transactionIndex",
            "logIndex",
            "removed",
            "event",
            "returnValues",
        ]);
    });
}
export async function fetchPoolEventsInBatches(poolId, offset, BATCH_SIZE) {
    const events = await RawTxLogs.findAll({
        where: { pool_id: poolId },
        order: [["block_number", "ASC"]],
        limit: BATCH_SIZE,
        offset: offset,
    });
    return events;
}
export async function getEntriesByBlockNumberIndex(index) {
    try {
        const distinctBlockNumbers = await RawTxLogs.findAll({
            attributes: [[fn("DISTINCT", col("block_number")), "block_number"]],
            order: [literal("block_number ASC")],
        });
        if (index < 1 || index > distinctBlockNumbers.length) {
            throw new Error(`Index out of range. Valid range is 1 to ${distinctBlockNumbers.length}.`);
        }
        const blockNumber = distinctBlockNumbers[index - 1].getDataValue("block_number");
        const entries = await RawTxLogs.findAll({
            where: {
                block_number: blockNumber,
            },
        });
        if (entries && entries.length > 0) {
            return entries.map((entry) => {
                const plainEntry = entry.get();
                const returnValues = Object.fromEntries(Object.entries(plainEntry.returnValues).filter(([key]) => isNaN(Number(key))));
                return pick(Object.assign(Object.assign({}, plainEntry), { returnValues }), [
                    "eventId",
                    "pool_id",
                    "address",
                    "blockNumber",
                    "transactionHash",
                    "transactionIndex",
                    "logIndex",
                    "removed",
                    "event",
                    "returnValues",
                ]);
            });
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error("Error retrieving entries:", error);
        return null;
    }
}
// Prints all the names of the different Events that occured, together with their counts.
export async function countEvents() {
    try {
        const counts = await RawTxLogs.findAll({
            attributes: ["event", [fn("COUNT", col("event")), "count"]],
            where: {
                event: {
                    [Op.notIn]: ["ClaimAdminFee", "Approval", "Transfer"],
                },
            },
            group: ["event"],
        });
        const eventCounts = {};
        for (const count of counts) {
            eventCounts[count.get("event")] = Number(count.get("count"));
        }
        return eventCounts;
    }
    catch (error) {
        console.error("Error counting events:", error);
        return {};
    }
}
export async function getEntriesByTransactionHash(transactionHash) {
    try {
        const entries = await RawTxLogs.findAll({
            where: {
                transaction_hash: transactionHash,
            },
        });
        if (entries && entries.length > 0) {
            return entries.map((entry) => {
                const plainEntry = entry.get();
                const returnValues = Object.fromEntries(Object.entries(plainEntry.returnValues).filter(([key]) => isNaN(Number(key))));
                return pick(Object.assign(Object.assign({}, plainEntry), { returnValues }), [
                    "id",
                    "pool_id",
                    "address",
                    "blockNumber",
                    "transactionHash",
                    "transactionIndex",
                    "logIndex",
                    "removed",
                    "event",
                    "returnValues",
                ]);
            });
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.error("Error retrieving entries:", error);
        return null;
    }
}
export async function countRawTxLogs() {
    return await RawTxLogs.count();
}
export async function getEventById(id) {
    const record = await RawTxLogs.findOne({ where: { eventId: id } });
    if (!record) {
        throw new Error(`Record with id ${id} not found`);
    }
    return record.event;
}
export async function getReturnValuesByEventId(eventId) {
    const logEntry = await RawTxLogs.findOne({ where: { eventId } });
    if (!logEntry) {
        console.log(`No RawTxLogs entry found with eventId ${eventId}.`);
        return null;
    }
    return logEntry.returnValues;
}
export async function getSmallestBlockNumber() {
    const minBlockNumber = await RawTxLogs.min("blockNumber");
    if (typeof minBlockNumber === "number") {
        return minBlockNumber;
    }
    return null;
}
export async function getLargestBlockNumber() {
    const maxBlockNumber = await RawTxLogs.max("blockNumber");
    if (typeof maxBlockNumber === "number") {
        return maxBlockNumber;
    }
    return null;
}
//# sourceMappingURL=RawLogs.js.map