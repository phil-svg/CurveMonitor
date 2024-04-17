import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

@Table({ tableName: 'coins' })
export class Coins extends Model {
  @Index
  @Column(DataType.STRING)
  address?: string | null;

  @Index
  @Column(DataType.STRING)
  symbol?: string | null;

  @Index
  @Column(DataType.INTEGER)
  decimals?: number | null;
}
