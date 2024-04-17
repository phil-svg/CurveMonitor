var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';
let TransactionDetails = class TransactionDetails extends Model {
};
__decorate([
    PrimaryKey,
    ForeignKey(() => Transactions),
    Column({
        field: 'tx_id',
        type: DataType.INTEGER,
    })
], TransactionDetails.prototype, "txId", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "blockHash", void 0);
__decorate([
    Index,
    Column(DataType.INTEGER)
], TransactionDetails.prototype, "blockNumber", void 0);
__decorate([
    Index,
    Column(DataType.STRING)
], TransactionDetails.prototype, "hash", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "chainId", void 0);
__decorate([
    Index,
    Column(DataType.STRING)
], TransactionDetails.prototype, "from", void 0);
__decorate([
    Column(DataType.BIGINT)
], TransactionDetails.prototype, "gas", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "gasPrice", void 0);
__decorate([
    Column(DataType.TEXT)
], TransactionDetails.prototype, "input", void 0);
__decorate([
    Column(DataType.INTEGER)
], TransactionDetails.prototype, "nonce", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "r", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "s", void 0);
__decorate([
    Index,
    Column(DataType.STRING)
], TransactionDetails.prototype, "to", void 0);
__decorate([
    Column(DataType.INTEGER)
], TransactionDetails.prototype, "transactionIndex", void 0);
__decorate([
    Column(DataType.INTEGER)
], TransactionDetails.prototype, "type", void 0);
__decorate([
    Column(DataType.STRING)
], TransactionDetails.prototype, "v", void 0);
__decorate([
    Index,
    Column(DataType.STRING)
], TransactionDetails.prototype, "value", void 0);
__decorate([
    BelongsTo(() => Transactions, 'txId')
], TransactionDetails.prototype, "transaction", void 0);
TransactionDetails = __decorate([
    Table({ tableName: 'transaction_details' })
], TransactionDetails);
export { TransactionDetails };
//# sourceMappingURL=TransactionDetails.js.map