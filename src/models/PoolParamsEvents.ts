// PoolParamsEvents.ts
import { Model, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, DataType, BelongsTo } from "sequelize-typescript";
import { Pool } from "./Pools.js";

@Table({ tableName: "pool_params_events" })
export class PoolParamsEvents extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id?: number;

  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  pool_id?: number;

  @Column(DataType.INTEGER)
  log_index?: number;

  @Column(DataType.INTEGER)
  last_block_checked?: number;

  @BelongsTo(() => Pool)
  pool?: Pool;

  @Column(DataType.STRING)
  event_name?: string;

  @Column(DataType.JSON)
  raw_log?: Array<any> | Record<string, any>;

  @Column(DataType.INTEGER)
  event_block?: number;

  @Column(DataType.INTEGER)
  event_timestamp?: number;
}
