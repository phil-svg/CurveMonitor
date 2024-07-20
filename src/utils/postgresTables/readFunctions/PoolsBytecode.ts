import { Bytecode } from '../../../models/PoolsByteCode.js';

/**
 * Retrieves the bytecode for a given pool ID.
 * @param poolId The ID of the pool for which to retrieve the bytecode.
 * @returns A Promise that resolves to the bytecode string or null if no bytecode is found.
 */
export async function getBytecodeByPoolId(poolId: number): Promise<string | null> {
  try {
    // Attempt to find a bytecode entry for the given pool ID
    const bytecodeEntry = await Bytecode.findOne({
      where: { poolId: poolId },
    });

    // If an entry is found, return the bytecode, otherwise return null
    return bytecodeEntry ? bytecodeEntry.bytecode : null;
  } catch (error) {
    console.error(`Failed to fetch bytecode for pool ID ${poolId}:`, error);
    return null; // Return null if there's an error fetching the bytecode
  }
}
