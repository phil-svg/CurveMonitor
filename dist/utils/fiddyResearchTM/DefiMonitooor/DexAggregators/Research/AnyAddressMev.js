import { getWeb3HttpProviderForChain } from '../../../../helperFunctions/Web3.js';
import { getPastEvents, getTxFromTxHashAndProvider } from '../../../../web3Calls/generic.js';
import { getCustomContract } from './CustomContract.js';
import { getCleanedTransfersWOdbWOtraceForChain } from './CleanTransfersWOdb.js';
async function solveSingleTxHash(txHash, chain, web3HttpProvider) {
    const tx = await getTxFromTxHashAndProvider(txHash, web3HttpProvider);
    const cleanedTransfers = await getCleanedTransfersWOdbWOtraceForChain(txHash, chain, web3HttpProvider, tx);
    const volInUsd = 1;
    const wasAtomicArb = true;
    const wasCexDexArb = true;
    return {
        volInUsd,
        wasAtomicArb,
        wasCexDexArb,
    };
}
export async function anyPoolMevCheck() {
    // 10 mins
    const startBlock = 17094494;
    const endBlock = 17094678;
    const chain = 'base';
    const web3HttpProvider = await getWeb3HttpProviderForChain(chain);
    const contract = await getCustomContract(web3HttpProvider);
    const events = await getPastEvents(contract, 'AllEvents', startBlock, endBlock);
    if (!Array.isArray(events))
        return;
    console.log('Found', events.length, 'events');
    for (const event of events) {
        await solveSingleTxHash(event.transactionHash, chain, web3HttpProvider);
    }
}
//# sourceMappingURL=AnyAddressMev.js.map