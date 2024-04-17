import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

@Table({ tableName: 'labels' })
export class Labels extends Model {
  @Index
  @Column(DataType.STRING)
  address!: string;

  @Index
  @Column(DataType.STRING)
  label!: string;
}
