import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

// indexes
@Table({
  tableName: 'riskMintMarketInfo',
  indexes: [
    {
      unique: false,
      fields: ['controller'],
    },
    {
      unique: false,
      fields: ['blockNumber'],
    },
    {
      unique: false,
      fields: ['controller', 'blockNumber'],
    },
  ],
})

// table structure
export class RiskMintMarketInfo extends Model {
  @Column({
    type: DataType.STRING(42),
    allowNull: false,
  })
  @Index
  controller!: string; // Ethereum address

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  @Index
  blockNumber!: number; // Block number of the transaction

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  band!: number; // Band information

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  amountBorrowableToken!: number; // Borrowable token amount

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  amountCollatToken!: number; // Collateral token amount

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  oraclePrice!: number; // Oracle price

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  get_p!: number; // get_p

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  amountCollatTokenInUsd!: number; // Collateral token in USD

  @Column({
    type: DataType.DECIMAL(30, 15),
    allowNull: false,
  })
  amountFullInBandInUsd!: number; // Full amount in band in USD

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  createdAt!: Date;
}
