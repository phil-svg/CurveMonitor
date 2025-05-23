import { WEB3_HTTP_PROVIDER } from '../../web3Calls/generic.js';

export async function getErc20Contract(address: string) {
  const ABI: any = [
    {
      name: 'Approval',
      inputs: [
        { name: 'owner', type: 'address', indexed: true },
        { name: 'spender', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
      anonymous: false,
      type: 'event',
    },
    {
      name: 'Transfer',
      inputs: [
        { name: 'sender', type: 'address', indexed: true },
        { name: 'receiver', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
      anonymous: false,
      type: 'event',
    },
    {
      name: 'SetMinter',
      inputs: [{ name: 'minter', type: 'address', indexed: true }],
      anonymous: false,
      type: 'event',
    },
    {
      stateMutability: 'nonpayable',
      type: 'constructor',
      inputs: [
        { name: '_name', type: 'string' },
        { name: '_symbol', type: 'string' },
      ],
      outputs: [],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'transferFrom',
      inputs: [
        { name: '_from', type: 'address' },
        { name: '_to', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'transfer',
      inputs: [
        { name: '_to', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'approve',
      inputs: [
        { name: '_spender', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'permit',
      inputs: [
        { name: '_owner', type: 'address' },
        { name: '_spender', type: 'address' },
        { name: '_value', type: 'uint256' },
        { name: '_deadline', type: 'uint256' },
        { name: '_v', type: 'uint8' },
        { name: '_r', type: 'bytes32' },
        { name: '_s', type: 'bytes32' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'increaseAllowance',
      inputs: [
        { name: '_spender', type: 'address' },
        { name: '_add_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'decreaseAllowance',
      inputs: [
        { name: '_spender', type: 'address' },
        { name: '_sub_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'burnFrom',
      inputs: [
        { name: '_from', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'burn',
      inputs: [{ name: '_value', type: 'uint256' }],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'mint',
      inputs: [
        { name: '_to', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      stateMutability: 'nonpayable',
      type: 'function',
      name: 'set_minter',
      inputs: [{ name: '_minter', type: 'address' }],
      outputs: [],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'DOMAIN_SEPARATOR',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'decimals',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'version',
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
    },
    { stateMutability: 'view', type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }] },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'symbol',
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
    },
    { stateMutability: 'view', type: 'function', name: 'salt', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'allowance',
      inputs: [
        { name: 'arg0', type: 'address' },
        { name: 'arg1', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'balanceOf',
      inputs: [{ name: 'arg0', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'totalSupply',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'nonces',
      inputs: [{ name: 'arg0', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      stateMutability: 'view',
      type: 'function',
      name: 'minter',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
    },
  ];

  return new WEB3_HTTP_PROVIDER.eth.Contract(ABI, address);
}
