// Bytecode.ts
import { Table, Column, Model, ForeignKey, DataType, CreatedAt, UpdatedAt, BelongsTo } from 'sequelize-typescript';
import { Pool } from './Pools.js';

@Table({ tableName: 'bytecode' })
export class Bytecode extends Model {
  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  poolId!: number;

  @Column(DataType.TEXT)
  bytecode!: string;

  @BelongsTo(() => Pool)
  pool!: Pool;
}
