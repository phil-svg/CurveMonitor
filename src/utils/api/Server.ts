import { startMainWsEndpoint } from './handlers/main/MainEndpointSetup.js';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { startHttpEndpoint } from '../../proxyCurvePrices/proxyCurvePricesMain.js';

export const startAPI = ({ wsBool }: { wsBool: boolean }, { httpBool }: { httpBool: boolean }): void => {
  const app = express();
  const server = http.createServer(app);

  if (wsBool) {
    const io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    io.on('error', (error) => {
      console.error(`Error at the server level: ${error}`);
    });

    startMainWsEndpoint(io);
  }

  if (httpBool) {
    startHttpEndpoint(app);
  }

  // Start the server on port 443
  const PORT = 443;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};
