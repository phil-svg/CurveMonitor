export interface EventProcessingResult {
  eventType: string;
  blockNumber: any;
  timestamp: any;
  ethPrice: number;
  txCostUSD: number;
  gross: number;
  net: number;
  transactionHash: string;
}
