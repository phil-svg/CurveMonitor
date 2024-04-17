import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import { Coins } from './Coins.js';

@Table({
  tableName: 'price_map',
})
export class PriceMap extends Model {
  @Index
  @ForeignKey(() => Coins)
  @Column({
    field: 'coin_id',
    type: DataType.INTEGER,
    allowNull: false,
  })
  coin_id!: number;

  @BelongsTo(() => Coins)
  coin!: Coins;

  @Column({
    field: 'coin_price_usd',
    type: DataType.DECIMAL(20, 10),
    allowNull: false,
    validate: {
      isLessThanOneBillion(value: number) {
        if (value >= 1e9) {
          throw new Error('coinPriceUsd must be less than 1 billion USD');
        }
      },
    },
  })
  coinPriceUsd!: number;

  @Column({
    field: 'price_timestamp',
    type: DataType.INTEGER,
    allowNull: false,
  })
  priceTimestamp!: number;
}
