import {
  Table,
  Column,
  Model,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import { Pool } from './Pools.js';

// Define a base model for AbisRelatedToAddressProvider with common properties
abstract class AbiModelRelatedToAddressProvider extends Model {
  @PrimaryKey
  @Column(DataType.STRING)
  declare address: string;

  @Column(DataType.JSON)
  declare abi: any[];

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}

// Extend the base model for AbisRelatedToAddressProvider
@Table({ tableName: 'abis_related_to_address_provider' })
export class AbisRelatedToAddressProvider extends AbiModelRelatedToAddressProvider {}

// Define a base model for AbisPools with common properties without address and abi columns
abstract class AbiModelPools extends Model {
  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}

// Extend the base model for AbisPools and add pool_id as the primary key
@Table({ tableName: 'abis_pools' })
export class AbisPools extends AbiModelPools {
  @PrimaryKey
  @ForeignKey(() => Pool)
  @Column(DataType.INTEGER)
  declare pool_id: number;

  @BelongsTo(() => Pool)
  pool?: Pool;

  @Column(DataType.JSON)
  declare abi: any[];

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}

export const AbiModels = [AbisPools, AbisRelatedToAddressProvider];