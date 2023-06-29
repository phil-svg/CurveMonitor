import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

@Table({
  tableName: "transaction_calls",
})
export class TransactionCalls extends Model {
  @PrimaryKey
  @ForeignKey(() => Transactions)
  @Column({
    field: "tx_id",
    type: DataType.INTEGER,
  })
  txId!: number;

  @Column(DataType.STRING)
  called_address!: string;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;
}
