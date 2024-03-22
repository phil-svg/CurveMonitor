import WebSocket from "ws";
async function unsubscribeSubscription(ws, subscriptionId) {
  return new Promise((resolve, reject) => {
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_unsubscribe",
        params: [subscriptionId],
      }),
      (error) => {
        if (error) {
          reject(`Error sending unsubscribe request for ${subscriptionId}: ${error}`);
        }
      }
    );
    ws.on("message", (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === 1) {
        resolve(response.result);
      }
    });
    ws.on("error", (error) => {
      reject(`WebSocket error: ${error}`);
    });
  });
}
