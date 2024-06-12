import bodyParser from 'body-parser';
import { fetchChainNames, fetchDataForChain } from './Pools.js';
export async function startHttpEndpoint(app) {
    app.use(bodyParser.json());
    const cache_curveprices_endpoint_chains = new Map();
    async function update_cache_curveprices_endpoint_chains() {
        const chainNames = await fetchChainNames();
        for (const chainName of chainNames) {
            try {
                const data = await fetchDataForChain(chainName);
                if (data) {
                    cache_curveprices_endpoint_chains.set(chainName, data);
                }
            }
            catch (error) {
                console.error(`Failed to fetch data for ${chainName}:`, error);
            }
        }
    }
    update_cache_curveprices_endpoint_chains(); // Initial data fetch on server start
    setInterval(update_cache_curveprices_endpoint_chains, 60000);
    // Debugging endpoint
    app.get('/debug', (req, res) => {
        console.log('Debug endpoint hit');
        res.status(200).send('Debugging endpoint reached successfully!');
    });
    // Endpoint to get data for a specific chain
    app.get('/proxyCurvePricesAPI/chains/:chainName', (req, res) => {
        console.log('received request: ', req.params.chainName);
        const chainName = req.params.chainName;
        const data = cache_curveprices_endpoint_chains.get(chainName);
        if (data) {
            res.json(data);
        }
        else {
            res.status(404).send('Data not found for chain: ' + chainName);
        }
    });
}
//# sourceMappingURL=proxyCurvePricesMain.js.map