import { TransactionCoins } from "../models/TransactionCoins";
import { TransactionData } from "../models/Transactions";

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

export interface Coin {
  address: string;
  COIN_ID: number;
  amount: number;
}

export interface CoinMovement {
  tx_id: number;
  coin_id: number;
  amount: string;
  direction: "in" | "out";
  coin: Coin;
}

export interface DefillamaSingleResponse {
  coins: Record<
    string,
    {
      decimals: number;
      price: number;
      symbol: string;
      timestamp: number;
    }
  >;
}

export interface DefillamaChartResponse {
  coins: Record<string, CoinInfo>;
}

export interface CoinPriceData {
  timestamp: number;
  price: number;
}

export interface CoinInfo {
  decimals: number;
  confidence: number;
  prices: CoinPriceData[];
  symbol: string;
}

export interface DefillamaFirstAppearanceResponse {
  coins: Record<
    string,
    {
      symbol: string;
      price: number;
      timestamp: number;
    }
  >;
}

export interface TransactionCoinRecord {
  tx_id: number;
  coin_id: number;
  amount: number;
  dollar_value?: number | null;
  direction: "in" | "out";
  coin_symbol: string | null;
}

export interface TransactionCoin {
  tx_id: number;
  coin_id: number;
  amount: string;
  dollar_value: null | string;
  direction: "in" | "out";
  coin_symbol: string | null;
}

export interface ExtendedTransactionData extends TransactionData {
  transactionCoins: TransactionCoin[];
}

export interface SandwichLoss {
  amount: number;
  unit: string;
  unitAddress: string;
  lossInPercentage: number;
}

export interface BlockNumber {
  block: string | number;
}

export interface Action {
  callType: string;
  from: string;
  gas: string;
  input: string;
  to: string;
  value: string;
}

export interface Result {
  gasUsed: string;
  output: string;
}

export interface ITransactionTrace {
  action: Action;
  blockHash: string;
  blockNumber: number;
  result: Result;
  subtraces: number;
  traceAddress: number[];
  transactionHash: string;
  type: string;
}

export interface TraceResponse {
  jsonrpc: string;
  result: ITransactionTrace[];
  id: number;
}

export type CallTrace = Array<{
  action: {
    from: string;
    to: string;
    value: string;
    callType: string;
  };
}>;

export interface BalanceChange {
  token: string;
  balanceChange: string;
  tokenSymbol?: string;
}

export interface TransferEvent {
  from: string;
  to: string;
  value: string;
  token: string;
}

export type CoinProperty = "address" | "symbol" | "decimals";

export interface FormattedArbitrageResult {
  extractedValue: Array<{
    address: string;
    symbol: string;
    amount: number;
  }>;
  bribe: {
    address: string;
    symbol: string;
    amount: number;
  };
  netWin: Array<{
    address: string;
    symbol: string;
    amount: number;
  }>;
  txGas: {
    gasUsed: number;
    gasPrice: number;
    gasCostETH: number;
  };
}

export interface ContractDetail {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}
