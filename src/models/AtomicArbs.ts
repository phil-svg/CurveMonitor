import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

@Index(["tx_id"])
@Index(["block_builder"])
@Table({ tableName: "atomic_arbs" })
export class AtomicArbs extends Model {
  @Unique
  @ForeignKey(() => Transactions)
  @Column({ type: DataType.INTEGER })
  tx_id!: number;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_atomic_arb!: boolean;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  net_win?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  revenue?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  bribe?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  gas_in_usd?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  total_cost?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  margin?: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  position?: number | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  gas_in_gwei?: number | null;

  @Index
  @Column({ type: DataType.STRING, allowNull: true })
  block_builder?: string | null;

  @Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
  block_payout_to_validator?: number | null;
}
