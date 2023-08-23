import { Table, Column, Model, DataType, PrimaryKey, ForeignKey, BelongsTo, AllowNull, AutoIncrement, HasMany, Index, Unique } from "sequelize-typescript";
import { Pool } from "./Pools.js";
import { RawTxLogs } from "./RawTxLogs.js";
import { TransactionCoins } from "./TransactionCoins.js";

export enum TransactionType {
  Swap = "swap",
  Deposit = "deposit",
  Remove = "remove",
}

@Index(["event_id"])
@Table({ tableName: "transactions" })
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

  @Column(DataType.STRING)
  tx_hash!: string;

  @Column(DataType.INTEGER)
  block_number!: number;

  @Column(DataType.BIGINT)
  block_unixtime!: number;

  @Column({
    type: DataType.ENUM,
    values: Object.values(TransactionType),
  })
  transaction_type!: TransactionType;

  @Column(DataType.STRING)
  trader!: string;

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
}

export type TransactionData = Pick<
  Transactions,
  "pool_id" | "tx_hash" | "block_number" | "block_unixtime" | "transaction_type" | "trader" | "tx_position" | "raw_fees" | "fee_usd" | "value_usd" | "event_id"
> & { tx_id?: number };
