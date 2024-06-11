import { Server } from 'socket.io';
import { startMainWsEndpoint } from './handlers/main/MainEndpointSetup.js';
const port = 443;
export const startAPI = () => {
    const io = new Server(port, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('error', (error) => {
        console.error(`Error at the server level: ${error}`);
    });
    startMainWsEndpoint(io);
    console.log(`Server started on port ${port}`);
};
//# sourceMappingURL=Server.js.map