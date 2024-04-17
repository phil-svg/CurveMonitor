import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Index,
} from 'sequelize-typescript';
import { Transactions } from './Transactions.js';

@Table({
  tableName: 'receipts',
  indexes: [
    {
      fields: ['transactionHash'],
      name: 'transactionHash_idx',
    },
  ],
})
@Table({ tableName: 'receipts' })
export class Receipts extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  receipt_id!: number;

  @ForeignKey(() => Transactions)
  @Index
  @Column(DataType.INTEGER)
  tx_id!: number;

  @Column(DataType.STRING)
  transactionHash!: string;

  @Column(DataType.STRING)
  blockHash!: string;

  @Index
  @Column(DataType.STRING)
  blockNumber!: string;

  @Column(DataType.STRING)
  address!: string;

  @Column(DataType.TEXT)
  data!: string;

  @Column(DataType.INTEGER)
  logIndex!: number;

  @Column(DataType.BOOLEAN)
  removed!: boolean;

  @Column(DataType.ARRAY(DataType.STRING))
  topics!: string[];

  @Column(DataType.STRING)
  transactionIndex!: string;

  @Column(DataType.STRING)
  id!: string;

  @AllowNull
  @Column(DataType.STRING)
  contractAddress?: string | null;

  @Column(DataType.STRING)
  effectiveGasPrice!: string;

  @Column(DataType.STRING)
  cumulativeGasUsed!: string;

  @Column(DataType.STRING)
  from!: string;

  @Column(DataType.STRING)
  gasUsed!: string;

  @Column(DataType.TEXT)
  logsBloom?: string;

  @Column(DataType.STRING)
  status?: string;

  @Column(DataType.STRING)
  to!: string;

  @Column(DataType.STRING)
  type!: string;

  @BelongsTo(() => Transactions, 'tx_id')
  transaction!: Transactions;
}
