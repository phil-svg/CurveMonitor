var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, Index, PrimaryKey } from "sequelize-typescript";
let Contracts = class Contracts extends Model {
};
__decorate([
    PrimaryKey,
    Column({
        field: "contract_address",
        type: DataType.STRING,
    })
], Contracts.prototype, "contractAddress", void 0);
__decorate([
    Index,
    Column({
        field: "creation_transaction_hash",
        type: DataType.STRING,
    })
], Contracts.prototype, "creationTransactionHash", void 0);
__decorate([
    Column({
        field: "creator_address",
        type: DataType.STRING,
    })
], Contracts.prototype, "creatorAddress", void 0);
__decorate([
    Column({
        field: "contract_creation_block",
        type: DataType.INTEGER,
    })
], Contracts.prototype, "contractCreationBlock", void 0);
__decorate([
    Column({
        field: "contract_creation_timestamp",
        type: DataType.BIGINT,
        allowNull: true,
    })
], Contracts.prototype, "contractCreationTimestamp", void 0);
Contracts = __decorate([
    Table({
        tableName: "contracts",
        indexes: [
            {
                name: "index_creation_transaction_hash",
                unique: true,
                fields: ["creation_transaction_hash"],
            },
        ],
    })
], Contracts);
export { Contracts };
//# sourceMappingURL=Contracts.js.map