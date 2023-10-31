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

export const ERC20_METHODS = [
  { name: "totalSupply", methodId: "0x18160ddd" },
  { name: "balanceOf", methodId: "0x70a08231" },
  { name: "transfer", methodId: "0xa9059cbb" },
  { name: "transferFrom", methodId: "0x23b872dd" },
  { name: "approve", methodId: "0x095ea7b3" },
  { name: "allowance", methodId: "0xdd62ed3e" },
  { name: "name", methodId: "0x06fdde03" },
  { name: "symbol", methodId: "0x95d89b41" },
  { name: "decimals", methodId: "0x313ce567" },
];
