import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';

@Table({ tableName: 'transaction_trace', indexes: [{ unique: false, fields: ['transactionHash'] }] })
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

  @Index
  @Column(DataType.INTEGER)
  subtraces!: number;

  @Index
  @Column(DataType.INTEGER)
  blockNumber!: number;

  @Index
  @Column(DataType.STRING)
  blockHash!: string;

  @Column(DataType.STRING)
  actionCallType!: string;

  @Index
  @Column(DataType.STRING)
  actionFrom!: string;

  @Index
  @Column(DataType.STRING)
  actionTo!: string;

  @Index
  @Column(DataType.STRING)
  actionGas!: string;

  @Index
  @Column(DataType.TEXT)
  actionInput!: string;

  @Index
  @Column(DataType.STRING)
  actionValue!: string;

  @Index
  @Column(DataType.STRING)
  resultGasUsed!: string;

  @Index
  @Column(DataType.TEXT)
  resultOutput!: string;
}
