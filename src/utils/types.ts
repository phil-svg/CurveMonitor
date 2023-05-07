export interface EventObject {
  address: string;
  blockHash: string;
  blockNumber: number;
  logIndex: number;
  removed: boolean;
  transactionHash: string;
  transactionIndex: number;
  id: string;
  returnValues: any;
  event: string;
  signature: string;
  raw: { data: string; topics: string[] };
}