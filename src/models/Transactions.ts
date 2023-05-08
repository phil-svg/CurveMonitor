import { Table, Column, Model, DataType, PrimaryKey, ForeignKey, BelongsTo, AllowNull } from "sequelize-typescript";
import { Pool } from "./Pools.js";
import { Coins } from "./Coins.js";

export enum TransactionType {
  Swap = "swap",
  Deposit = "deposit",
  Remove = "remove",
}

@Table({ tableName: "transactions" })
export class Transactions extends Model {
  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  pool_id!: number;

  @BelongsTo(() => Pool)
  pool!: Pool;

  @PrimaryKey
  @Column(DataType.STRING)
  tx_hash!: string;

  @Column(DataType.INTEGER)
  block_number!: number;

  @Column(DataType.BIGINT)
  unixtime!: number;

  @Column({
    type: DataType.ENUM,
    values: Object.values(TransactionType),
  })
  transaction_type!: TransactionType;

  @Column(DataType.STRING)
  trader!: string;

  @Column(DataType.INTEGER)
  position!: number;

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
}
