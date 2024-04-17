import { Table, Column, Model, DataType, ForeignKey, BelongsTo, AllowNull, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';

export interface LossTransaction {
  tx_id: number;
  amount: number;
  unit: string;
  unitAddress: string;
  lossInPercentage: number;
  lossInUsd: number;
}

@Table({ tableName: 'sandwiches' })
export class Sandwiches extends Model {
  @Index
  @Column(DataType.INTEGER)
  pool_id!: number;

  @ForeignKey(() => Transactions)
  @Index
  @Column(DataType.INTEGER)
  frontrun!: number;

  @BelongsTo(() => Transactions)
  frontrunTransaction!: Transactions;

  @ForeignKey(() => Transactions)
  @Index
  @Column(DataType.INTEGER)
  backrun!: number;

  @BelongsTo(() => Transactions)
  backrunTransaction!: Transactions;

  @Index
  @Column(DataType.JSONB)
  loss_transactions?: LossTransaction[] | null;

  @Index
  @Column(DataType.BOOLEAN)
  extracted_from_curve!: boolean;

  @AllowNull(true)
  @Index
  @Column(DataType.STRING)
  source_of_loss_contract_address?: string | null;
}
