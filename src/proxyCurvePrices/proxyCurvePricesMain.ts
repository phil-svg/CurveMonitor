import express from 'express';
import bodyParser from 'body-parser';

import { CurveResponse, fetchChainNames, fetchDataForChain } from './Pools.js';

export async function startProxyCurvePricesAPI() {
  const app = express();
  app.use(bodyParser.json());

  const chainDataCache = new Map<string, CurveResponse>();

  // Endpoint to get data for a specific chain
  app.get('/proxyCurvePricesAPI/chains/:chainName', (req, res) => {
    console.log('received request: ', req);
    const chainName = req.params.chainName;
    const data = chainDataCache.get(chainName);
    console.log('data: ', data);
    if (data) {
      res.json(data);
    } else {
      res.status(404).send('Data not found for chain: ' + chainName);
    }
  });

  async function updateDataForAllChains() {
    const chainNames = await fetchChainNames();
    for (const chainName of chainNames) {
      try {
        const data = await fetchDataForChain(chainName);
        if (data) {
          chainDataCache.set(chainName, data);
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${chainName}:`, error);
      }
    }
  }

  setInterval(updateDataForAllChains, 60000);

  // Start the server
  const PORT = process.env.PORT;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    updateDataForAllChains(); // Initial data fetch on server start
  });
}
