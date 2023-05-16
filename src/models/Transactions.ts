import { Table, Column, Model, DataType, PrimaryKey, ForeignKey, BelongsTo, AllowNull, AutoIncrement } from "sequelize-typescript";
import { Pool } from "./Pools.js";
import { Coins } from "./Coins.js";
import { RawTxLogs } from "./RawTxLogs.js";

export enum TransactionType {
  Swap = "swap",
  Deposit = "deposit",
  Remove = "remove",
}

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
  @Column(DataType.DECIMAL(30, 15))
  amount_in?: number;

  @AllowNull(true)
  @ForeignKey(() => Coins)
  @Column(DataType.INTEGER)
  coin_id_in?: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(30, 15))
  amount_out?: number;

  @AllowNull(true)
  @ForeignKey(() => Coins)
  @Column(DataType.INTEGER)
  coin_id_out?: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(30, 15))
  fee_usd?: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(30, 15))
  value_usd?: number;

  @BelongsTo(() => Coins, "coin_id_in")
  coinIn!: Coins;

  @BelongsTo(() => Coins, "coin_id_out")
  coinOut!: Coins;

  @BelongsTo(() => RawTxLogs)
  rawTxLog!: RawTxLogs;
}

export type TransactionData = Pick<Transactions, "pool_id" | "tx_hash" | "block_number" | "block_unixtime" | "transaction_type" | "trader" | "tx_position"> & {
  amount_in?: number | null;
  coin_id_in?: number | null;
  amount_out?: number | null;
  coin_id_out?: number | null;
  fee_usd?: number | null;
  value_usd?: number | null;
  event_id?: number | null;
};
