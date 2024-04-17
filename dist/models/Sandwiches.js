var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, AllowNull, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';
let Sandwiches = class Sandwiches extends Model {
};
__decorate([
    Index,
    Column(DataType.INTEGER)
], Sandwiches.prototype, "pool_id", void 0);
__decorate([
    ForeignKey(() => Transactions),
    Index,
    Column(DataType.INTEGER)
], Sandwiches.prototype, "frontrun", void 0);
__decorate([
    BelongsTo(() => Transactions)
], Sandwiches.prototype, "frontrunTransaction", void 0);
__decorate([
    ForeignKey(() => Transactions),
    Index,
    Column(DataType.INTEGER)
], Sandwiches.prototype, "backrun", void 0);
__decorate([
    BelongsTo(() => Transactions)
], Sandwiches.prototype, "backrunTransaction", void 0);
__decorate([
    Index,
    Column(DataType.JSONB)
], Sandwiches.prototype, "loss_transactions", void 0);
__decorate([
    Index,
    Column(DataType.BOOLEAN)
], Sandwiches.prototype, "extracted_from_curve", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.STRING)
], Sandwiches.prototype, "source_of_loss_contract_address", void 0);
Sandwiches = __decorate([
    Table({ tableName: 'sandwiches' })
], Sandwiches);
export { Sandwiches };
//# sourceMappingURL=Sandwiches.js.map