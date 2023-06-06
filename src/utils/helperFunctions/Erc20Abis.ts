export const ABI_TRANSFER: any[] = [
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
