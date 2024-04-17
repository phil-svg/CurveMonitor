import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';

@Table({ tableName: 'transaction_details' })
export class TransactionDetails extends Model {
  @PrimaryKey
  @ForeignKey(() => Transactions)
  @Column({
    field: 'tx_id',
    type: DataType.INTEGER,
  })
  txId!: number;

  @Column(DataType.STRING)
  blockHash!: string;

  @Index
  @Column(DataType.INTEGER)
  blockNumber!: number;

  @Index
  @Column(DataType.STRING)
  hash!: string;

  @Column(DataType.STRING)
  chainId!: string;

  @Index
  @Column(DataType.STRING)
  from!: string;

  @Column(DataType.BIGINT)
  gas!: bigint;

  @Column(DataType.STRING)
  gasPrice!: string;

  @Column(DataType.TEXT)
  input!: string;

  @Column(DataType.INTEGER)
  nonce!: number;

  @Column(DataType.STRING)
  r!: string;

  @Column(DataType.STRING)
  s!: string;

  @Index
  @Column(DataType.STRING)
  to!: string;

  @Column(DataType.INTEGER)
  transactionIndex!: number;

  @Column(DataType.INTEGER)
  type!: number;

  @Column(DataType.STRING)
  v!: string;

  @Index
  @Column(DataType.STRING)
  value!: string;

  @BelongsTo(() => Transactions, 'txId')
  transaction!: Transactions;
}
