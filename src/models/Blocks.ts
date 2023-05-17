import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "blocks" })
export class Blocks extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    allowNull: false,
  })
  block_number!: number;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
  })
  timestamp!: number;
}
