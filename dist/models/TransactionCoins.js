var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Index } from 'sequelize-typescript';
import { Transactions } from './Transactions.js';
import { Coins } from './Coins.js';
let TransactionCoins = class TransactionCoins extends Model {
};
__decorate([
    PrimaryKey,
    ForeignKey(() => Transactions),
    Column(DataType.INTEGER)
], TransactionCoins.prototype, "tx_id", void 0);
__decorate([
    PrimaryKey,
    ForeignKey(() => Coins),
    Index,
    Column(DataType.INTEGER)
], TransactionCoins.prototype, "coin_id", void 0);
__decorate([
    BelongsTo(() => Transactions)
], TransactionCoins.prototype, "transaction", void 0);
__decorate([
    BelongsTo(() => Coins)
], TransactionCoins.prototype, "coin", void 0);
__decorate([
    Index,
    Column(DataType.DECIMAL(50, 15))
], TransactionCoins.prototype, "amount", void 0);
__decorate([
    Index,
    Column(DataType.DECIMAL(30, 15))
], TransactionCoins.prototype, "dollar_value", void 0);
__decorate([
    Index,
    Column({
        type: DataType.ENUM,
        values: ['in', 'out'],
    })
], TransactionCoins.prototype, "direction", void 0);
TransactionCoins = __decorate([
    Table({ tableName: 'transaction_coins' })
], TransactionCoins);
export { TransactionCoins };
//# sourceMappingURL=TransactionCoins.js.map