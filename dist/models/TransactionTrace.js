var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from "sequelize-typescript";
let TransactionTrace = class TransactionTrace extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER)
], TransactionTrace.prototype, "id", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "transactionHash", void 0);
__decorate([
    Column(DataType.ARRAY(DataType.INTEGER))
], TransactionTrace.prototype, "traceAddress", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "type", void 0);
__decorate([
    Column(DataType.INTEGER)
], TransactionTrace.prototype, "subtraces", void 0);
__decorate([
    Column(DataType.INTEGER)
], TransactionTrace.prototype, "blockNumber", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "blockHash", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "actionCallType", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "actionFrom", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "actionTo", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "actionGas", void 0);
__decorate([
    Column(DataType.TEXT)
], TransactionTrace.prototype, "actionInput", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "actionValue", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionTrace.prototype, "resultGasUsed", void 0);
__decorate([
    Column(DataType.TEXT)
], TransactionTrace.prototype, "resultOutput", void 0);
TransactionTrace = __decorate([
    Table({ tableName: "transaction_trace", indexes: [{ unique: false, fields: ["transactionHash"] }] })
], TransactionTrace);
export { TransactionTrace };
//# sourceMappingURL=TransactionTrace.js.map