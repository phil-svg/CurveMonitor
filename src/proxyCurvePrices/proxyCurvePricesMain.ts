import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { CurveResponse, fetchChainNames, fetchDataForChain } from './Pools.js';
import { startMainWsEndpoint } from '../utils/api/handlers/main/MainEndpointSetup.js';

export async function startProxyCurvePricesAPI() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  startMainWsEndpoint(io);

  app.use(bodyParser.json());

  const chainDataCache = new Map<string, CurveResponse>();

  // Debugging endpoint
  app.get('/debug', (req, res) => {
    console.log('Debug endpoint hit');
    res.status(200).send('Debugging endpoint reached successfully!');
  });

  // Endpoint to get data for a specific chain
  app.get('/proxyCurvePricesAPI/chains/:chainName', (req, res) => {
    console.log('received request: ', req.params.chainName);
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

  // Start the server on port 443
  const PORT = 443;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    updateDataForAllChains(); // Initial data fetch on server start
  });
}
