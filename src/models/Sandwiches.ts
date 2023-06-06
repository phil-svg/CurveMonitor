import { Table, Column, Model, DataType, AllowNull } from "sequelize-typescript";

export interface LossTransaction {
  tx_id: number;
  amount: number;
  unit: string;
  lossInPercentage: number;
}

@Table({ tableName: "sandwiches" })
export class Sandwiches extends Model {
  @Column(DataType.INTEGER)
  frontrun!: number;

  @AllowNull(true)
  @Column(DataType.JSONB)
  loss_transactions?: LossTransaction[] | null;

  @Column(DataType.INTEGER)
  backrun!: number;

  @Column(DataType.BOOLEAN)
  extracted_from_curve!: boolean;

  @AllowNull(true)
  @Column(DataType.STRING)
  source_of_loss_contract_address?: string | null;
}
