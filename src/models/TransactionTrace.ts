import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

@Table({ tableName: "transaction_trace", indexes: [{ unique: false, fields: ["transactionHash"] }] })
export class TransactionTrace extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => Transactions)
  @Column(DataType.STRING)
  transactionHash!: string;

  @Column(DataType.ARRAY(DataType.INTEGER))
  traceAddress!: number[];

  @Column(DataType.STRING)
  type!: string;

  @Column(DataType.INTEGER)
  subtraces!: number;

  @Column(DataType.INTEGER)
  blockNumber!: number;

  @Column(DataType.STRING)
  blockHash!: string;

  @Column(DataType.STRING)
  actionCallType!: string;

  @Column(DataType.STRING)
  actionFrom!: string;

  @Column(DataType.STRING)
  actionTo!: string;

  @Column(DataType.STRING)
  actionGas!: string;

  @Column(DataType.TEXT)
  actionInput!: string;

  @Column(DataType.STRING)
  actionValue!: string;

  @Column(DataType.STRING)
  resultGasUsed!: string;

  @Column(DataType.TEXT)
  resultOutput!: string;
}
