import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "labels" })
export class Labels extends Model {
  @Column(DataType.STRING)
  address!: string;

  @Column(DataType.STRING)
  label!: string;
}
