import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "proxy_checks" })
export class ProxyCheck extends Model {
  @Column({ primaryKey: true, type: DataType.STRING })
  contractAddress!: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  is_proxy_contract!: boolean | null;

  @Column({ type: DataType.STRING, allowNull: true })
  implementation_address!: string | null;
}
