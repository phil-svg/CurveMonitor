var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, PrimaryKey, CreatedAt, UpdatedAt, DataType, ForeignKey, BelongsTo, Index } from "sequelize-typescript";
import { Pool } from "./Pools.js";
// Define a base model for AbisRelatedToAddressProvider with common properties
class AbiModelRelatedToAddressProvider extends Model {
}
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], AbiModelRelatedToAddressProvider.prototype, "address", void 0);
__decorate([
    Column(DataType.JSON)
], AbiModelRelatedToAddressProvider.prototype, "abi", void 0);
__decorate([
    CreatedAt,
    Column(DataType.DATE)
], AbiModelRelatedToAddressProvider.prototype, "createdAt", void 0);
__decorate([
    UpdatedAt,
    Column(DataType.DATE)
], AbiModelRelatedToAddressProvider.prototype, "updatedAt", void 0);
// Extend the base model for AbisRelatedToAddressProvider
let AbisRelatedToAddressProvider = class AbisRelatedToAddressProvider extends AbiModelRelatedToAddressProvider {
};
AbisRelatedToAddressProvider = __decorate([
    Table({ tableName: "abis_related_to_address_provider" })
], AbisRelatedToAddressProvider);
export { AbisRelatedToAddressProvider };
// Define a base model for AbisPools with common properties without address and abi columns
class AbiModelPools extends Model {
}
__decorate([
    CreatedAt,
    Column(DataType.DATE)
], AbiModelPools.prototype, "createdAt", void 0);
__decorate([
    UpdatedAt,
    Column(DataType.DATE)
], AbiModelPools.prototype, "updatedAt", void 0);
// Extend the base model for AbisPools and add pool_id as the primary key
let AbisPools = class AbisPools extends AbiModelPools {
};
__decorate([
    PrimaryKey,
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], AbisPools.prototype, "pool_id", void 0);
__decorate([
    BelongsTo(() => Pool)
], AbisPools.prototype, "pool", void 0);
__decorate([
    Column(DataType.JSON)
], AbisPools.prototype, "abi", void 0);
__decorate([
    CreatedAt,
    Column(DataType.DATE)
], AbisPools.prototype, "createdAt", void 0);
__decorate([
    UpdatedAt,
    Column(DataType.DATE)
], AbisPools.prototype, "updatedAt", void 0);
AbisPools = __decorate([
    Table({ tableName: "abis_pools" })
], AbisPools);
export { AbisPools };
// Define a base model for AbisEthereum with common properties
class AbiModelEthereum extends Model {
}
__decorate([
    CreatedAt,
    Column(DataType.DATE)
], AbiModelEthereum.prototype, "createdAt", void 0);
__decorate([
    UpdatedAt,
    Column(DataType.DATE)
], AbiModelEthereum.prototype, "updatedAt", void 0);
// Extend the base model for AbisEthereum
let AbisEthereum = class AbisEthereum extends AbiModelEthereum {
};
__decorate([
    Index,
    PrimaryKey,
    Column({ type: DataType.STRING, unique: true })
], AbisEthereum.prototype, "contract_address", void 0);
__decorate([
    Column({ type: DataType.JSON, allowNull: true })
], AbisEthereum.prototype, "abi", void 0);
__decorate([
    Column({ type: DataType.BOOLEAN })
], AbisEthereum.prototype, "is_verified", void 0);
AbisEthereum = __decorate([
    Table({ tableName: "abis_ethereum" })
], AbisEthereum);
export { AbisEthereum };
export const AbiModels = [AbisPools, AbisRelatedToAddressProvider, AbisEthereum];
//# sourceMappingURL=Abi.js.map