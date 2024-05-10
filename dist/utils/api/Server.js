import { Server } from 'socket.io';
import { startMainEndpoint } from './handlers/main/MainEndpointSetup.js';
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
    startMainEndpoint(io);
    console.log(`Server started on port ${port}`);
};
//# sourceMappingURL=Server.js.map