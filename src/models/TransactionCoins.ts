import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
import { Coins } from "./Coins.js";

@Table({ tableName: "transaction_coins" })
export class TransactionCoins extends Model {
  @PrimaryKey
  @ForeignKey(() => Transactions)
  @Column(DataType.INTEGER)
  tx_id!: number;

  @PrimaryKey
  @ForeignKey(() => Coins)
  @Column(DataType.INTEGER)
  coin_id!: number;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;

  @BelongsTo(() => Coins)
  coin!: Coins;

  @Column(DataType.DECIMAL(30, 15))
  amount!: number;

  @Column({
    type: DataType.ENUM,
    values: ["in", "out"],
  })
  direction!: "in" | "out";
}