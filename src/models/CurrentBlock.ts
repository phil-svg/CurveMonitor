import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({
  tableName: "current_block",
})
export class CurrentBlock extends Model {
  @Column({
    field: "block_number",
    type: DataType.INTEGER,
    allowNull: false,
  })
  blockNumber!: number;
}
