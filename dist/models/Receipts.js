var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement, AllowNull } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let Receipts = class Receipts extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER)
], Receipts.prototype, "receipt_id", void 0);
__decorate([
    ForeignKey(() => Transactions),
    Column(DataType.INTEGER)
], Receipts.prototype, "tx_id", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "transactionHash", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "blockHash", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "blockNumber", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "address", void 0);
__decorate([
    Column(DataType.TEXT)
], Receipts.prototype, "data", void 0);
__decorate([
    Column(DataType.INTEGER)
], Receipts.prototype, "logIndex", void 0);
__decorate([
    Column(DataType.BOOLEAN)
], Receipts.prototype, "removed", void 0);
__decorate([
    Column(DataType.ARRAY(DataType.STRING))
], Receipts.prototype, "topics", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "transactionIndex", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "id", void 0);
__decorate([
    AllowNull,
    Column(DataType.STRING)
], Receipts.prototype, "contractAddress", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "effectiveGasPrice", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "cumulativeGasUsed", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "from", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "gasUsed", void 0);
__decorate([
    Column(DataType.TEXT)
], Receipts.prototype, "logsBloom", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "status", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "to", void 0);
__decorate([
    Column(DataType.STRING)
], Receipts.prototype, "type", void 0);
__decorate([
    BelongsTo(() => Transactions, "tx_id")
], Receipts.prototype, "transaction", void 0);
Receipts = __decorate([
    Table({
        tableName: "receipts",
        indexes: [
            {
                fields: ["transactionHash"],
                name: "transactionHash_idx",
            },
        ],
    }),
    Table({ tableName: "receipts" })
], Receipts);
export { Receipts };
//# sourceMappingURL=Receipts.js.map