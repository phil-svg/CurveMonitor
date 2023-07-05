import { Server } from "socket.io";
import { startMainEndpoint } from "./handlers/main/Index.js";

const port = 443;

export const startAPI = (): void => {
  const io = new Server(port, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  startMainEndpoint(io);
  console.log(`Server started on port ${port}`);
};
