import { Table, Column, Model, DataType, Index, PrimaryKey } from "sequelize-typescript";

@Table({
  tableName: "contracts",
  indexes: [
    {
      name: "index_creation_transaction_hash",
      unique: true,
      fields: ["creation_transaction_hash"],
    },
  ],
})
export class Contracts extends Model {
  @PrimaryKey
  @Column({
    field: "contract_address",
    type: DataType.STRING,
  })
  contractAddress!: string;

  @Index
  @Column({
    field: "creation_transaction_hash",
    type: DataType.STRING,
  })
  creationTransactionHash!: string;

  @Column({
    field: "creator_address",
    type: DataType.STRING,
  })
  creatorAddress!: string;

  @Column({
    field: "contract_creation_block",
    type: DataType.INTEGER,
  })
  contractCreationBlock?: number;

  @Column({
    field: "contract_creation_timestamp",
    type: DataType.BIGINT,
    allowNull: true,
  })
  contractCreationTimestamp?: number;
}
