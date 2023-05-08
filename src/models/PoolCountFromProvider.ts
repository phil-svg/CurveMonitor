import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "pool_count_from_provider" })
export class PoolCountFromProvider extends Model {
  @Column(DataType.STRING)
  address!: string;

  @Column(DataType.INTEGER)
  count!: number;
}
