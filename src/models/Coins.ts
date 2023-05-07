import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

@Table({ tableName: 'coins' })
export class Coins extends Model {
  @Column(DataType.STRING)
  address?: string | null;

  @Column(DataType.STRING)
  symbol?: string | null;

  @Column(DataType.INTEGER)
  decimals?: number | null;
}