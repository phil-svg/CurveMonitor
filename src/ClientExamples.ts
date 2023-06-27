import { io } from "socket.io-client";

console.clear();

export function startTestClient() {
  const socket = io("wss://api.curvemonitor.com", {
    //const socket = io("https://api.curvemonitor.com:443", {
  });

  socket.on("connect", () => {
    console.log("Connected to the server.");

    // request for ws-connection test
    socket.emit("runSequenceUpdate");

    // request for labels ranking
    // socket.emit("getLabelsRanking");

    socket.on("message", (msg) => {
      console.log("Server said: " + msg);
    });

    socket.on("sequenceUpdate", (testMessage) => {
      console.log(testMessage);
    });

    socket.on("labelsRanking", (labelsRanking) => {
      console.log("Received labels ranking: ", labelsRanking);
    });

    socket.emit("message", "Hello from the client!");
  });

  socket.on("connect_error", (err) => {
    console.log(`Connection Error: ${err}`);
  });

  socket.on("error", (err) => {
    console.log(`Error: ${err}`);
  });
}

// Call the function to start the client
startTestClient();
