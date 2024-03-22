import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

@Table({ tableName: "is_cex_dex_arb" })
export class IsCexDexArb extends Model {
  @Unique
  @ForeignKey(() => Transactions)
  @Index
  @Column({ type: DataType.INTEGER })
  tx_id!: number;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_cex_dex_arb!: boolean;
}
