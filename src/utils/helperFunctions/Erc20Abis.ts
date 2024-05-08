export const ABI_TRANSFER: any[] = [
  {
    name: 'Transfer',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        indexed: true,
      },
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
      },
    ],
    anonymous: false,
    type: 'event',
  },
];

export const ERC20_ABI: any[] = [
  {
    constant: true,
    inputs: [],
    name: 'mintingFinished',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'value', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
];

export const ERC20_METHODS = [
  { name: 'totalSupply', methodId: '0x18160ddd' },
  { name: 'balanceOf', methodId: '0x70a08231' },
  { name: 'transfer', methodId: '0xa9059cbb' },
  { name: 'transferFrom', methodId: '0x23b872dd' },
  { name: 'approve', methodId: '0x095ea7b3' },
  { name: 'allowance', methodId: '0xdd62ed3e' },
  { name: 'name', methodId: '0x06fdde03' },
  { name: 'symbol', methodId: '0x95d89b41' },
  { name: 'decimals', methodId: '0x313ce567' },
];
