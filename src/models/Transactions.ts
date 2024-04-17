import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AllowNull,
  AutoIncrement,
  HasMany,
  Index,
  Unique,
  HasOne,
} from 'sequelize-typescript';
import { Pool } from './Pools.js';
import { RawTxLogs } from './RawTxLogs.js';
import { TransactionCoins } from './TransactionCoins.js';
import { TransactionDetails } from './TransactionDetails.js'; // Import TransactionDetails
import { TransactionTrace } from './TransactionTrace.js';
import { Receipts } from './Receipts.js';

export enum TransactionType {
  Swap = 'swap',
  Deposit = 'deposit',
  Remove = 'remove',
}

@Index(['event_id'])
@Table({ tableName: 'transactions' })
export class Transactions extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  tx_id!: number;

  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  pool_id!: number;

  @BelongsTo(() => Pool)
  pool!: Pool;

  @AllowNull(true)
  @Unique
  @ForeignKey(() => RawTxLogs)
  @Column(DataType.INTEGER)
  event_id?: number;

  @Index
  @Column(DataType.STRING)
  tx_hash!: string;

  @Index
  @Column(DataType.INTEGER)
  block_number!: number;

  @Index
  @Column(DataType.BIGINT)
  block_unixtime!: number;

  @Column({
    type: DataType.ENUM,
    values: Object.values(TransactionType),
  })
  transaction_type!: TransactionType;

  @Index
  @Column(DataType.STRING)
  trader!: string;

  @Index
  @Column(DataType.INTEGER)
  tx_position!: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  raw_fees?: number | null;

  @AllowNull(true)
  @Column(DataType.DECIMAL(30, 15))
  fee_usd?: number | null;

  @AllowNull(true)
  @Column(DataType.DECIMAL(30, 15))
  value_usd?: number | null;

  @BelongsTo(() => RawTxLogs)
  rawTxLog!: RawTxLogs;

  @HasMany(() => TransactionCoins)
  transactionCoins!: TransactionCoins[];

  @HasOne(() => TransactionDetails, 'txId')
  transactionDetails!: TransactionDetails;

  @HasMany(() => TransactionTrace, 'transactionHash')
  transactionTraces!: TransactionTrace[];

  @HasMany(() => Receipts, {
    foreignKey: 'tx_id',
    sourceKey: 'tx_id',
  })
  receipts!: Receipts[];
}

export type TransactionData = Pick<
  Transactions,
  | 'pool_id'
  | 'tx_hash'
  | 'block_number'
  | 'block_unixtime'
  | 'transaction_type'
  | 'trader'
  | 'tx_position'
  | 'raw_fees'
  | 'fee_usd'
  | 'value_usd'
  | 'event_id'
> & { tx_id?: number };
