import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique, PrimaryKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";

@Table({ tableName: "cex_dex_arbs" })
export class CexDexArbs extends Model {
  @Unique
  @PrimaryKey
  @ForeignKey(() => Transactions)
  @Index
  @Column({ type: DataType.INTEGER })
  tx_id!: number;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;

  @Index
  @Column({ type: DataType.STRING, allowNull: true })
  bot_address?: string | null;

  @Index
  @Column({ type: DataType.INTEGER })
  pool_id!: number;
}
