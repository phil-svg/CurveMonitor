import { RawTxLogs } from "../../../models/RawTxLogs.js";

export async function getHighestStoredBlockForPoolId(poolId: number): Promise<number> {
  try {
    const highestBlock = await RawTxLogs.findOne({
      where: { pool_id: poolId },
      order: [["block_number", "DESC"]],
    });

    if (highestBlock) {
      return highestBlock.blockNumber;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error retrieving the highest block number:", error);
    return 0;
  }
}

export async function getEntriesByBlockNumberAndPoolId(blockNumber: number, poolId: number): Promise<RawTxLogs[] | null> {
  try {
    const entries = await RawTxLogs.findAll({
      where: {
        block_number: blockNumber,
        pool_id: poolId,
      },
    });

    if (entries && entries.length > 0) {
      return entries;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error retrieving entries:", error);
    return null;
  }
}

export async function fetchPoolEventsInBatches(poolId: number, offset: number, BATCH_SIZE: number): Promise<RawTxLogs[]> {
  const events = await RawTxLogs.findAll({
    where: { pool_id: poolId },
    order: [["block_number", "ASC"]],
    limit: BATCH_SIZE,
    offset: offset,
  });

  return events;
}
