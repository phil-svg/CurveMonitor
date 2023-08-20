export const ABI_TRANSFER = [
    {
        name: "Transfer",
        inputs: [
            {
                name: "sender",
                type: "address",
                indexed: true,
            },
            {
                name: "receiver",
                type: "address",
                indexed: true,
            },
            {
                name: "value",
                type: "uint256",
                indexed: false,
            },
        ],
        anonymous: false,
        type: "event",
    },
];
//# sourceMappingURL=Erc20Abis.js.map