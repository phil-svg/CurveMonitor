import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({
  tableName: "block_scanning_data",
})
export class BlockScanningData extends Model {
  @Column({
    field: "from_block_raw_logs",
    type: DataType.INTEGER,
  })
  fromBlockRawLogs!: number;

  @Column({
    field: "to_block_raw_logs",
    type: DataType.INTEGER,
  })
  toBlockRawLogs!: number;

  @Column({
    field: "from_block_event_parsing",
    type: DataType.INTEGER,
  })
  fromBlockEventParsing?: number;

  @Column({
    field: "to_block_event_parsing",
    type: DataType.INTEGER,
  })
  toBlockEventParsing?: number;
}
