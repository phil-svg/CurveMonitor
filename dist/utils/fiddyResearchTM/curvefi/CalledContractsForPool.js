import { getWeb3HttpProvider } from '../../helperFunctions/Web3.js';
import { getPastEvents } from '../../web3Calls/generic.js';
import fs from 'fs';
export async function poolTrafficCalledContractsWOdb() {
    let WEB_HTTP_ROVIDER = await getWeb3HttpProvider();
    const poolAddress = '0x11fd5664121e9b464b5e8434aa7d70b8e9146ca6'; // Arbi
    const abi = [
        {
            name: 'TokenExchange',
            inputs: [
                { name: 'buyer', type: 'address', indexed: true },
                { name: 'sold_id', type: 'int128', indexed: false },
                { name: 'tokens_sold', type: 'uint256', indexed: false },
                { name: 'bought_id', type: 'int128', indexed: false },
                { name: 'tokens_bought', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
    ];
    const contract = new WEB_HTTP_ROVIDER.eth.Contract(abi, poolAddress);
    const endBlock = 298514475;
    const blocksPerMinute = 240;
    const minutes = 60 * 24;
    const startBlock = endBlock - blocksPerMinute * minutes;
    const events = await getPastEvents(contract, 'TokenExchange', startBlock, endBlock);
    const volumeByAddress = {};
    if (events && Array.isArray(events)) {
        for (const [index, event] of events.entries()) {
            try {
                // Print progress every 10 events
                if (index % 10 === 0) {
                    console.log(`Processing event ${index + 1} of ${events.length} (${(((index + 1) / events.length) * 100).toFixed(1)}%)`);
                }
                const txHash = event.transactionHash;
                const tx = await WEB_HTTP_ROVIDER.eth.getTransaction(txHash);
                const to = tx.to;
                const { sold_id, tokens_sold, tokens_bought } = event.returnValues;
                let vol = 0;
                if (sold_id === '0') {
                    vol = Number(tokens_sold) / 1e6;
                }
                else {
                    vol = Number(tokens_bought) / 1e6;
                }
                if (to && volumeByAddress[to]) {
                    volumeByAddress[to] += vol;
                }
                else if (to) {
                    volumeByAddress[to] = vol;
                }
            }
            catch (err) {
                continue;
            }
        }
    }
    // Sort volumeByAddress from low to high volume
    const sortedVolumeByAddress = Object.fromEntries(Object.entries(volumeByAddress).sort(([, a], [, b]) => a - b));
    // Save sorted data to JSON
    fs.writeFileSync('volumeByAddress.json', JSON.stringify(sortedVolumeByAddress, null, 2));
    return volumeByAddress;
}
//# sourceMappingURL=CalledContractsForPool.js.map