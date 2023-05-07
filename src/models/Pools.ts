// pools.ts
import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  CreatedAt,
  AllowNull,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { PoolParamsEvents } from './PoolParamsEvents.js';
import { InitialParams } from './InitialParams.js';

export enum PoolVersion {
  v1 = 'v1',
  v2 = 'v2',
}

@Table({ tableName: 'pools' })
export class Pool extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Column(DataType.STRING)
  address!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  name?: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  n_coins?: number;

  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.STRING))
  coins?: string[] | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  lp_token?: string | null;

  @AllowNull(true)
  @Column({
    type: DataType.ENUM,
    values: Object.values(PoolVersion),
  })
  version?: PoolVersion;

  @AllowNull(true)
  @Column(DataType.STRING)
  base_pool?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  source_address?: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  inception_block?: number;

  @AllowNull(true)
  @Column({
    field: 'creation_timestamp',
    type: DataType.INTEGER,
  })
  creation_timestamp?: number;

  @AllowNull(true)
  @CreatedAt
  @Column({
    field: 'creation_date',
    type: DataType.DATE,
  })
  creation_date?: Date;

  @HasMany(() => PoolParamsEvents)
  poolParams?: PoolParamsEvents[];

  @HasOne(() => InitialParams)
  initialParams?: InitialParams;
}
