import { TransactionData, TransactionType } from "../models/Transactions.js";

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

export interface TransactionDetail {
  tx_id: number;
  pool_id: number;
  event_id?: number;
  tx_hash: string;
  block_number: number;
  block_unixtime: number;
  transaction_type: TransactionType;
  called_contract_by_user: string;
  trader: string;
  tx_position: number;
  coins_leaving_wallet: CoinDetail[];
  coins_entering_wallet: CoinDetail[];
}

export interface CoinDetail {
  coin_id: number;
  amount: number;
  name: string;
  address: string;
}

export interface EnrichedTransactionDetail extends TransactionDetail {
  poolAddress: string;
  poolName: string;
  calledContractLabel: string;
  from: string;
  calledContractInceptionTimestamp: number;
  isCalledContractFromCurve: boolean;
}

export interface ReadableTokenTransfer {
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  parsedAmount: number;
  position?: number;
}

export type TokenTransfer = {
  from: string;
  to: string;
  token: string;
  value: string;
};

export type LiquidityEvent = [ReadableTokenTransfer, ReadableTokenTransfer[]];

export type SwapGroup = ReadableTokenTransfer[];

export interface ExtendedReadableTokenTransfer extends ReadableTokenTransfer {
  position?: number;
}

export type SwapPair = [ExtendedReadableTokenTransfer, ExtendedReadableTokenTransfer];

export type EtherWrapUnwrapPair = [ReadableTokenTransfer, ReadableTokenTransfer];

export interface CategorizedTransfers {
  etherWrapsAndUnwraps: EtherWrapUnwrapPair[];
  liquidityEvents: LiquidityEvent[];
  swaps: SwapGroup[];
  inflowingETH: ReadableTokenTransfer[];
  outflowingETH: ReadableTokenTransfer[];
  multiStepSwaps: SwapGroup[];
  liquidityPairs: SwapPair[];
  isolatedTransfers: ReadableTokenTransfer[];
  remainder: ReadableTokenTransfer[];
}
