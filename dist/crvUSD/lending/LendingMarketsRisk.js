import { fetchLendingMarketsForChain } from './Utils.js';
async function runMarket(chain, market) {
    console.log('market:', market);
    // const blocksPerMonth = 5 * 60 * 24 * 30;
    // const endBlock = 21199440;
    // // const startBlock = endBlock - blocksPerMonth; // aprox 1 month
    // const startBlock = endBlock - blocksPerMonth * 3; // aprox 3 month
    // const events = await getPastEventsForChain(chain, ammContract, 'TokenExchange', startBlock, endBlock);
}
async function runChain(chain) {
    const marketsResponse = await fetchLendingMarketsForChain(chain);
    const markets = marketsResponse.data;
    for (const market of markets) {
        await runMarket(chain, market);
    }
}
export async function startLendingMarketsRisk() {
    const chains = ['ethereum'];
    // const chains = ['ethereum', 'fraxtal', 'optimism'];
    for (const chain of chains) {
        await runChain(chain);
    }
}
//# sourceMappingURL=LendingMarketsRisk.js.map