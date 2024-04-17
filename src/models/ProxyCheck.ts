import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

@Table({ tableName: 'proxy_checks' })
export class ProxyCheck extends Model {
  @Index
  @Column({ primaryKey: true, type: DataType.STRING })
  contractAddress!: string;

  @Index
  @Column({ type: DataType.BOOLEAN, allowNull: true })
  is_proxy_contract!: boolean | null;

  @Index
  @Column({ type: DataType.STRING, allowNull: true })
  implementation_address!: string | null;

  @Index
  @Column({ type: DataType.ARRAY(DataType.STRING), allowNull: true })
  checked_standards!: string[] | null;
}
