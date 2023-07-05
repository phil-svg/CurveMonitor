export default function handleAllTxDemo(socket) {
    socket.on("allTxDemo", (data) => {
        console.log("Received allTxDemo event with data:", data);
    });
}
//# sourceMappingURL=AllTxDemo.js.map