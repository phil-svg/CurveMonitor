import { Table, Column, Model, DataType, AllowNull, HasMany, ForeignKey, BelongsTo } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

export interface LossTransaction {
  tx_id: number;
  amount: number;
  unit: string;
  lossInPercentage: number;
}

@Table({ tableName: "sandwiches" })
export class Sandwiches extends Model {
  @AllowNull(false)
  @ForeignKey(() => Transactions)
  @Column(DataType.INTEGER)
  frontrun!: number;

  @BelongsTo(() => Transactions)
  frontrunTransaction!: Transactions;

  @AllowNull(false)
  @ForeignKey(() => Transactions)
  @Column(DataType.INTEGER)
  backrun!: number;

  @BelongsTo(() => Transactions)
  backrunTransaction!: Transactions;

  @AllowNull(true)
  @Column(DataType.JSONB)
  loss_transactions?: LossTransaction[] | null;

  @Column(DataType.BOOLEAN)
  extracted_from_curve!: boolean;

  @AllowNull(true)
  @Column(DataType.STRING)
  source_of_loss_contract_address?: string | null;
}
