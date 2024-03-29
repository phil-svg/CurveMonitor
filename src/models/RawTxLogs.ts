import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement } from "sequelize-typescript";
import { Pool } from "./Pools.js";

@Table({
  tableName: "raw_tx_logs",
  indexes: [
    {
      name: "unique_blockhash_logindex",
      unique: true,
      fields: ["block_hash", "logIndex"],
    },
    {
      name: "index_on_pool_id",
      fields: ["pool_id"],
    },
  ],
})
export class RawTxLogs extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    field: "event_id",
    type: DataType.INTEGER,
  })
  eventId!: number;

  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  pool_id!: number;

  @Column(DataType.STRING)
  address!: string;

  @Column({
    field: "block_number",
    type: DataType.INTEGER,
  })
  blockNumber!: number;

  @Column({
    field: "transaction_hash",
    type: DataType.STRING,
  })
  transactionHash!: string;

  @Column({
    field: "transaction_index",
    type: DataType.INTEGER,
  })
  transactionIndex!: number;

  @Column({
    field: "block_hash",
    type: DataType.STRING,
  })
  blockHash!: string;

  @Column(DataType.INTEGER)
  logIndex!: number;

  @Column(DataType.BOOLEAN)
  removed!: boolean;

  @Column(DataType.STRING)
  log_id!: string;

  @Column(DataType.JSON)
  returnValues!: object;

  @Column(DataType.STRING)
  event!: string;

  @Column(DataType.STRING)
  signature!: string;

  @Column(DataType.JSON)
  raw!: object;

  @BelongsTo(() => Pool)
  pool!: Pool;
}
