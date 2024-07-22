import bodyParser from 'body-parser';
import cors from 'cors';
import { getPoolLaunchesLast7Days } from '../utils/api/queries/Pools.js';
import { fetchPoolsWithCoins } from './Endpoints/AllPoolsInfo.js';
import { getPoolAbiByPoolAddress } from '../utils/postgresTables/readFunctions/Abi.js';
export async function startHttpEndpoint(app) {
    app.use(bodyParser.json());
    const corsOptions = {
        origin: ['http://localhost:8080', 'https://api.curvemonitor.com', 'https://curvemonitor.com'],
        methods: ['GET', 'POST'],
        credentials: true,
    };
    app.use(cors(corsOptions));
    // Debugging endpoint
    app.get('/debug', (req, res) => {
        console.log('Debug endpoint hit');
        res.status(200).send('Debugging endpoint reached successfully!');
    });
    // Endpoint to get data for a specific chain
    app.get('/proxyCurvePricesAPI/chains/:chainName', (req, res) => {
        console.log('received request: ', req.params.chainName);
        const chainName = req.params.chainName;
        const data = 'foo';
        if (data) {
            res.json(data);
        }
        else {
            res.status(404).send('Data not found for chain: ' + chainName);
        }
    });
    // returns info about the most recent pools created. 7 days.
    app.get('/getPoolLaunchesLast7Days', async (req, res) => {
        console.log('getPoolLaunchesLast7Days endpoint hit');
        try {
            const data = await getPoolLaunchesLast7Days();
            if (data) {
                res.json(data);
            }
            else {
                res.status(404).send('Data not found');
            }
        }
        catch (error) {
            console.error('Error fetching pool launches:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    // Endpoint to fetch pools with their associated coins
    app.get('/poolsWithCoins', async (req, res) => {
        try {
            const poolsWithCoins = await fetchPoolsWithCoins();
            res.json(poolsWithCoins);
        }
        catch (error) {
            console.error('Error fetching pools with coins:', error);
            res.status(500).send('Internal Server Error while fetching pools with coins');
        }
    });
    // Endpoint to get the ABI for a pool based on its Ethereum address
    app.get('/poolAbi/:address', async (req, res) => {
        const { address } = req.params;
        try {
            const poolAbi = await getPoolAbiByPoolAddress(address);
            if (poolAbi) {
                res.json(poolAbi);
            }
            else {
                res.status(404).send(`No ABI found for the pool with address ${address}`);
            }
        }
        catch (error) {
            console.error('Error fetching ABI for address:', error);
            res.status(500).send('Internal Server Error while fetching ABI');
        }
    });
}
//# sourceMappingURL=StaticAPI.js.map