import { TransactionType } from '../models/TransactionType.js';

export interface EventObject {
  address: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
  id: string;
  returnValues: {
    [key: string]: any;
  };
  event: string;
  signature: string;
  raw: {
    data: string;
    topics: string[];
  };
}

export interface Coin {
  symbol: any;
  address: string;
  COIN_ID: number;
  amount: number;
}

export interface CoinMovement {
  tx_id: number;
  coin_id: number;
  amount: string;
  direction: 'in' | 'out';
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
  direction: 'in' | 'out';
  coin_symbol: string | null;
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
  tokenAddress: string;
  balanceChange: number;
  tokenSymbol?: string;
}

export interface TransferEvent {
  from: string;
  to: string;
  value: string;
  token: string;
}

export type CoinProperty = 'address' | 'symbol' | 'decimals';

export interface FormattedArbitrageResult {
  extractedValue: Array<{
    address: string;
    symbol: string;
    amount: number;
  }>;
  bribe:
    | {
        address: string;
        symbol: string;
        amount: number;
      }
    | 'unknown';
  netWin:
    | Array<{
        address: string;
        symbol: string;
        amount: number;
      }>
    | 'unknown';
  txGas: {
    gasUsed: number;
    gasPrice: number;
    gasCostETH: number;
  };
  blockBuilder: string | null;
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

export type ParsedEvent = {
  contractAddress: string;
  eventName: string;
  [key: string]: string;
};

export interface USDValuedArbitrageResult {
  ethPrice: number | null;
  bribeInETH: number | 'unknown';
  bribeInUSD: number | 'unknown';
  fullCostETH: number | 'unknown';
  fullCostUSD: number | 'unknown';
  extractedValue: Array<{ address: string; symbol: string; amount: number; amountInUSD: number }> | 'unknown';
  netWin: Array<{ address: string; symbol: string; amount: number; amountInUSD: number }> | 'unknown';
  txGas: {
    gasUsed: number;
    gasPrice: number;
    gasCostETH: number;
    gasCostUSD: number;
  };
  blockBuilder: string | null;
}

export interface ProfitDetails {
  netWin: number | 'unknown';
  revenue: number | 'unknown';
  bribe: number | 'unknown';
  gas: number;
  totalCost: number | 'unknown';
  gasInGwei: number | null;
  blockBuilder: string | null;
}

export interface TransactionDetailsForAtomicArbs extends EnrichedTransactionDetail {
  revenue: number | null;
  gasInUsd: number;
  gasInGwei: number | null;
  netWin: number | null;
  bribe: number | null;
  totalCost: number | null;
  blockBuilder: string | null;
  validatorPayOffUSD: number | null;
}

export interface AtomicArbTableContent {
  data: TransactionDetailsForAtomicArbs[];
  totalNumberOfAtomicArbs: number;
}

export interface Subscription {
  unsubscribe: (callback: (error: any, success: any) => void) => void;
  connection?: { readyState: number };
}

export interface EnrichedCexDexDetails extends TransactionDetail {
  // builder: string;
  // blockPayoutETH: number;
  // blockPayoutUSD: number;
  // eoaNonce: number;
  gasInGwei: number;
  gasCostUSD: number;
  bribeInUSD: number;
}

export interface CexDexArbTableContent {
  data: EnrichedCexDexDetails[];
  totalNumberOfCexDexArbs: number;
}

export interface ArbBotLeaderBoardbyTxCount {
  contractAddress: string;
  txCount: number;
}

export interface DurationType {
  value: number;
  unit:
    | 'minute'
    | 'minutes'
    | 'hour'
    | 'hours'
    | 'day'
    | 'days'
    | 'week'
    | 'weeks'
    | 'month'
    | 'months'
    | 'year'
    | 'years'
    | 'full';
}

export type DurationInput = DurationType | string;

export type IntervalInput = DurationType | 'max';

export interface LabelRankingShort {
  address: string;
  label: string;
  occurrences: number;
}

export interface LabelRankingExtended {
  address: string;
  label: string;
  occurrences: number;
  numOfAllTx: number;
}

export interface UserSearchResult {
  address: string;
  name: string | null;
}