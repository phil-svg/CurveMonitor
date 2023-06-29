import { Table, Column, Model, DataType, PrimaryKey } from "sequelize-typescript";

@Table({
  tableName: "address_counts",
})
export class AddressesCalledCounts extends Model {
  @PrimaryKey
  @Column(DataType.STRING)
  called_address!: string;

  @Column(DataType.INTEGER)
  count!: number;
}
