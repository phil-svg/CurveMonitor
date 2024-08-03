export interface SwapEventUniV3 {
  address: string;
  blockHash: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  removed: boolean;
  id: string;
  returnValues: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    sender: string;
    recipient: string;
    amount0: string;
    amount1: string;
    sqrtPriceX96: string;
    liquidity: string;
    tick: string;
  };
  event: string;
  signature: string;
  raw: {
    data: string;
    topics: string[];
  };
}

export interface SimplifiedUniV3SwapEvent {
  txHash: string;
  blockNumber: number;
  position: number;
  unixTime: number;
  sold: string;
  bought: string;
  swap: string;
  soldAmount: number;
  boughtAmount: number;
  user: string;
}
