import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "unverified_contracts" })
export class UnverifiedContracts extends Model {
  @Column({ type: DataType.STRING, primaryKey: true })
  contract_address!: string;
}
