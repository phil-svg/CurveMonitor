import { Pool } from '../../models/Pools.js';
import { Bytecode } from '../../models/PoolsByteCode.js';
import { WEB3_HTTP_PROVIDER } from '../web3Calls/generic.js';
/**
 * Fetches the bytecode of a contract from the Ethereum mainnet.
 * @param contractAddress The Ethereum contract address.
 * @returns A Promise that resolves to the contract's bytecode as a string or null if not found.
 */
async function getContractBytecode(contractAddress) {
    try {
        const bytecode = await WEB3_HTTP_PROVIDER.eth.getCode(contractAddress, 'latest');
        // Check if the bytecode is more than '0x' (which means it actually has code)
        if (bytecode && bytecode !== '0x') {
            return bytecode;
        }
        else {
            console.log('No bytecode found for this contract address:', contractAddress);
            return null;
        }
    }
    catch (error) {
        // console.error('Error fetching contract bytecode:', error);
        return null; // Return null if there's an error fetching the bytecode
    }
}
export async function updatePoolsBytecode() {
    console.log('update PoolsBytecode');
    try {
        // Fetch pools potentially without bytecode entries
        const poolsWithBytecode = await Pool.findAll({
            include: [
                {
                    model: Bytecode,
                    required: false,
                },
            ],
        });
        const poolsWithoutBytecode = poolsWithBytecode.filter((pool) => !pool.bytecode);
        const pools = poolsWithoutBytecode;
        for (const pool of pools) {
            const bytecode = await getContractBytecode(pool.address);
            if (bytecode) {
                // Check if a bytecode record already exists
                if (pool.bytecode) {
                    // If it exists, update it
                    await pool.bytecode.update({ bytecode });
                }
                else {
                    // If not, create a new record
                    await Bytecode.create({
                        poolId: pool.id,
                        bytecode: bytecode,
                    });
                }
            }
            else {
                console.log('Could not fetch bytecode for', pool.address);
            }
        }
        console.log(`[✓] updatePoolsBytecode completed successfully.`);
    }
    catch (error) {
        console.error('Error updating pool bytecodes:', error);
    }
}
//# sourceMappingURL=ByteCode.js.map