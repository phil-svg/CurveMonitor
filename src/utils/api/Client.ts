import { io } from "socket.io-client";

export function startTestClient() {
  const socket = io("http://localhost:3000", {
    extraHeaders: {
      "X-API-KEY": "your_secret_api_key",
    },
  });

  socket.on("connect", () => {
    console.log("Connected to the server.");

    // request for ping-pong updates
    socket.emit("runPingPongUpdate");

    // request for labels ranking
    // socket.emit("getLabelsRanking");

    socket.on("message", (msg) => {
      console.log("Server said: " + msg);
    });

    socket.on("labelsRanking", (labelsRanking) => {
      console.log("Received labels ranking: ", labelsRanking);
    });

    socket.emit("message", "Hello from the client!");
  });
}
