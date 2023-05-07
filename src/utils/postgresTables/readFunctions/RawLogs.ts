import { RawTxLogs } from '../../../models/RawTxLogs.js';

export async function getHighestStoredBlockForPoolId(poolId: number): Promise<number> {
  try {
    const highestBlock = await RawTxLogs.findOne({
      where: { pool_id: poolId },
      order: [['block_number', 'DESC']],
    });

    if (highestBlock) {
      return highestBlock.blockNumber;
    } else {
      return 0;
    }
  } catch (error) {
    console.error('Error retrieving the highest block number:', error);
    return 0;
  }
}
