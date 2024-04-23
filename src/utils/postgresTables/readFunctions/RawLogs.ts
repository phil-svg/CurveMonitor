import { Op, fn, col, literal, Sequelize } from 'sequelize';
import { RawTxLogs } from '../../../models/RawTxLogs.js';
import pkg from 'lodash';
import { TransactionWithPoolId } from '../txParsing/ParseTx.js';
const { pick, isNaN } = pkg;

export async function getHighestBlockNumberForPool(poolId: number): Promise<number | null> {
  try {
    const result = await RawTxLogs.max('blockNumber', { where: { pool_id: poolId } });
    return typeof result === 'number' ? result : null;
  } catch (error) {
    console.error('Error fetching highest block number: ', error);
    return null;
  }
}

export async function getEntriesByBlockNumberAndPoolId(
  blockNumber: number,
  poolId: number
): Promise<RawTxLogs[] | null> {
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
    console.error('Error retrieving entries:', error);
    return null;
  }
}

export async function fetchDistinctBlockNumbers() {
  const distinctBlockNumbers = await RawTxLogs.findAll({
    attributes: [[fn('DISTINCT', col('block_number')), 'block_number']],
    order: [['block_number', 'ASC']],
  });

  return distinctBlockNumbers.map((row) => row.getDataValue('block_number'));
}

export async function fetchDistinctBlockNumbersInBatch(offset: number, batchSize: number) {
  const distinctBlockNumbers = await RawTxLogs.findAll({
    attributes: [[fn('DISTINCT', col('block_number')), 'block_number']],
    order: [['block_number', 'ASC']],
    offset: offset,
    limit: batchSize,
  });

  return distinctBlockNumbers.map((row) => row.getDataValue('block_number'));
}

export async function fetchAllDistinctBlockNumbers() {
  const distinctBlockNumbers = await RawTxLogs.findAll({
    attributes: [[fn('DISTINCT', col('block_number')), 'block_number']],
    order: [['block_number', 'ASC']],
  });

  return distinctBlockNumbers.map((row) => row.getDataValue('block_number'));
}

// works faster, but less safe
export async function fetchEventsForChunkParsing(startBlock: number, endBlock: number): Promise<Partial<RawTxLogs>[]> {
  const events = await RawTxLogs.findAll({
    where: {
      block_number: {
        [Op.gte]: startBlock,
        [Op.lte]: endBlock,
      },
    },
    order: [['block_number', 'ASC']],
  });

  return events.map((event) => {
    const plainEvent = event.get();
    const returnValues = Object.fromEntries(
      Object.entries(plainEvent.returnValues).filter(([key]) => isNaN(Number(key)))
    );

    return pick({ ...plainEvent, returnValues }, [
      'eventId',
      'pool_id',
      'address',
      'blockNumber',
      'transactionHash',
      'transactionIndex',
      'logIndex',
      'removed',
      'event',
      'returnValues',
    ]);
  });
}

/**
 * Fetches raw transaction log events based on an array of transaction hash and pool id combinations.
 * @param transactionHashesWithPoolIds Array of objects containing transaction hashes and pool ids.
 * @returns A promise that resolves to an array of partial RawTxLogs entries.
 */
export async function fetchRawEventsByTransactionHashes(
  transactionHashesWithPoolIds: TransactionWithPoolId[]
): Promise<Partial<RawTxLogs>[]> {
  // Extract transaction hashes and pool ids from the input array
  const transactionHashes = transactionHashesWithPoolIds.map((t) => t.transaction_hash);
  const poolIds = transactionHashesWithPoolIds.map((t) => t.pool_id);

  // Find all entries that match both transaction hash and pool id
  const events = await RawTxLogs.findAll({
    where: {
      transaction_hash: { [Op.in]: transactionHashes },
      pool_id: { [Op.in]: poolIds },
    },
    order: [['block_number', 'ASC']],
  });

  // Map the raw events to a simplified format
  return events.map((event) => {
    const plainEvent = event.get({ plain: true });
    const returnValues = Object.fromEntries(
      Object.entries(plainEvent.returnValues).filter(([key]) => isNaN(Number(key)))
    );

    return pick(plainEvent, [
      'eventId',
      'pool_id',
      'address',
      'blockNumber',
      'transactionHash',
      'transactionIndex',
      'logIndex',
      'removed',
      'event',
      'returnValues',
    ]);
  });
}

export async function fetchEventsForChunkParsingForPoolId(
  startBlock: number,
  endBlock: number,
  poolId: number
): Promise<Partial<RawTxLogs>[]> {
  const events = await RawTxLogs.findAll({
    where: {
      block_number: {
        [Op.gte]: startBlock,
        [Op.lte]: endBlock,
      },
      pool_id: poolId,
    },
    order: [['block_number', 'ASC']],
  });

  return events.map((event) => {
    const plainEvent = event.get({ plain: true }); // Ensure to get plain object
    const returnValues = Object.fromEntries(
      Object.entries(plainEvent.returnValues).filter(([key]) => isNaN(Number(key)))
    );

    return pick({ ...plainEvent, returnValues }, [
      'eventId',
      'pool_id',
      'address',
      'blockNumber',
      'transactionHash',
      'transactionIndex',
      'logIndex',
      'removed',
      'event',
      'returnValues',
    ]);
  });
}

export async function fetchPoolEventsInBatches(
  poolId: number,
  offset: number,
  BATCH_SIZE: number
): Promise<RawTxLogs[]> {
  const events = await RawTxLogs.findAll({
    where: { pool_id: poolId },
    order: [['block_number', 'ASC']],
    limit: BATCH_SIZE,
    offset: offset,
  });

  return events;
}

export async function getEntriesByBlockNumberIndex(index: number): Promise<Partial<RawTxLogs>[] | null> {
  try {
    const distinctBlockNumbers = await RawTxLogs.findAll({
      attributes: [[fn('DISTINCT', col('block_number')), 'block_number']],
      order: [literal('block_number ASC')],
    });

    if (index < 1 || index > distinctBlockNumbers.length) {
      throw new Error(`Index out of range. Valid range is 1 to ${distinctBlockNumbers.length}.`);
    }

    const blockNumber = distinctBlockNumbers[index - 1].getDataValue('block_number');

    const entries = await RawTxLogs.findAll({
      where: {
        block_number: blockNumber,
      },
    });

    if (entries && entries.length > 0) {
      return entries.map((entry) => {
        const plainEntry = entry.get();
        const returnValues = Object.fromEntries(
          Object.entries(plainEntry.returnValues).filter(([key]) => isNaN(Number(key)))
        );
        return pick({ ...plainEntry, returnValues }, [
          'eventId',
          'pool_id',
          'address',
          'blockNumber',
          'transactionHash',
          'transactionIndex',
          'logIndex',
          'removed',
          'event',
          'returnValues',
        ]);
      });
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error retrieving entries:', error);
    return null;
  }
}

// Prints all the names of the different Events that occured, together with their counts.
export async function countEvents(): Promise<{ [eventName: string]: number }> {
  try {
    const counts = await RawTxLogs.findAll({
      attributes: ['event', [fn('COUNT', col('event')), 'count']],
      where: {
        event: {
          [Op.notIn]: ['ClaimAdminFee', 'Approval', 'Transfer'],
        },
      },
      group: ['event'],
    });

    const eventCounts: { [eventName: string]: number } = {};
    for (const count of counts) {
      eventCounts[count.get('event')] = Number(count.get('count'));
    }

    return eventCounts;
  } catch (error) {
    console.error('Error counting events:', error);
    return {};
  }
}

export async function getEntriesByTransactionHash(transactionHash: string): Promise<Partial<RawTxLogs>[] | null> {
  try {
    const entries = await RawTxLogs.findAll({
      where: {
        transaction_hash: transactionHash,
      },
    });

    if (entries && entries.length > 0) {
      return entries.map((entry) => {
        const plainEntry = entry.get();
        const returnValues = Object.fromEntries(
          Object.entries(plainEntry.returnValues).filter(([key]) => isNaN(Number(key)))
        );
        return pick({ ...plainEntry, returnValues }, [
          'id',
          'pool_id',
          'address',
          'blockNumber',
          'transactionHash',
          'transactionIndex',
          'logIndex',
          'removed',
          'event',
          'returnValues',
        ]);
      });
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error retrieving entries:', error);
    return null;
  }
}

export async function countRawTxLogs(): Promise<number> {
  return await RawTxLogs.count();
}

export async function getEventById(id: number): Promise<string> {
  const record = await RawTxLogs.findOne({ where: { eventId: id } });

  if (!record) {
    throw new Error(`Record with id ${id} not found`);
  }

  return record.event;
}

export async function getEntireEventById(id: number): Promise<any | null> {
  const record = await RawTxLogs.findOne({ where: { eventId: id } });

  if (!record) {
    throw new Error(`Record with id ${id} not found`);
  }

  return record;
}

export async function getReturnValuesByEventId(eventId: number): Promise<any | null> {
  const logEntry = await RawTxLogs.findOne({ where: { eventId } });

  if (!logEntry) {
    console.log(`No RawTxLogs entry found with eventId ${eventId}.`);
    return null;
  }

  return logEntry.returnValues;
}

export async function getSmallestBlockNumber(): Promise<number | null> {
  const minBlockNumber = await RawTxLogs.min('blockNumber');

  if (typeof minBlockNumber === 'number') {
    return minBlockNumber;
  }

  return null;
}

export async function getLargestBlockNumber(): Promise<number | null> {
  const maxBlockNumber = await RawTxLogs.max('blockNumber');

  if (typeof maxBlockNumber === 'number') {
    return maxBlockNumber;
  }

  return null;
}

export async function getAllEventIdsByTxHash(txHash: string): Promise<number[]> {
  try {
    const rawTxLogs = await RawTxLogs.findAll({
      where: {
        transactionHash: txHash,
      },
      attributes: ['eventId'],
    });

    const eventIds = rawTxLogs.map((txLog) => txLog.eventId);
    return eventIds;
  } catch (error) {
    console.error('Error fetching event IDs by transaction hash:', error);
    return [];
  }
}
