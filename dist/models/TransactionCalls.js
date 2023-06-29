var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let TransactionCalls = class TransactionCalls extends Model {
};
__decorate([
    PrimaryKey,
    ForeignKey(() => Transactions),
    Column({
        field: "tx_id",
        type: DataType.INTEGER,
    })
], TransactionCalls.prototype, "txId", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionCalls.prototype, "called_address", void 0);
__decorate([
    BelongsTo(() => Transactions)
], TransactionCalls.prototype, "transaction", void 0);
TransactionCalls = __decorate([
    Table({
        tableName: "transaction_calls",
    })
], TransactionCalls);
export { TransactionCalls };
//# sourceMappingURL=TransactionCalls.js.map