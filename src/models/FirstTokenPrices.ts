import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index } from "sequelize-typescript";
import { Coins } from "./Coins.js";

@Table({
  tableName: "first_price_timestamp",
})
export class FirstPriceTimestamp extends Model {
  @Index
  @ForeignKey(() => Coins)
  @Column({
    field: "coin_id",
    type: DataType.INTEGER,
    allowNull: false,
  })
  coin_id!: number;

  @BelongsTo(() => Coins)
  coin!: Coins;

  @Column({
    field: "first_timestamp_defillama",
    type: DataType.INTEGER,
    allowNull: true,
  })
  firstTimestampDefillama?: number | null;
}
