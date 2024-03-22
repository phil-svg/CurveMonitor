import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
import { ReadableTokenTransfer } from "../utils/Interfaces.js";

@Table({ tableName: "token_transfers" })
export class TokenTransfers extends Model {
  @Unique
  @ForeignKey(() => Transactions)
  @Index
  @Column({ type: DataType.INTEGER })
  tx_id!: number;

  @BelongsTo(() => Transactions)
  transaction!: Transactions;

  @Column({ type: DataType.JSONB })
  cleaned_transfers!: ReadableTokenTransfer[];
}
