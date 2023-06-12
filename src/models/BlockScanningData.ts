import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({
  tableName: "block_scanning_data",
})
export class BlockScanningData extends Model {
  @Column({
    field: "scanned_block_range_raw_logs",
    type: DataType.ARRAY(DataType.STRING),
  })
  scannedBlockRangeRawLogs!: string[];

  @Column({
    field: "scanned_block_range_event_parsing",
    type: DataType.ARRAY(DataType.STRING),
  })
  scannedBlockRangeEventParsing?: string[];
}
