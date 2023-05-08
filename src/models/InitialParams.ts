// InitialParams.ts
import { Model, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, DataType, BelongsTo } from "sequelize-typescript";
import { Pool } from "./Pools.js";

@Table({ tableName: "initial_params" })
export class InitialParams extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id?: number;

  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  pool_id?: number;

  @BelongsTo(() => Pool)
  pool?: Pool;

  @Column(DataType.STRING)
  A?: string | null;

  @Column(DataType.STRING)
  fee?: string | null;

  @Column(DataType.STRING)
  gamma?: string | null;
}
