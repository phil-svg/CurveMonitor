var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey, ForeignKey, BelongsTo, AllowNull } from "sequelize-typescript";
import { Pool } from "./Pools.js";
import { Coins } from "./Coins.js";
export var TransactionType;
(function (TransactionType) {
    TransactionType["Swap"] = "swap";
    TransactionType["Deposit"] = "deposit";
    TransactionType["Remove"] = "remove";
})(TransactionType || (TransactionType = {}));
let Transactions = class Transactions extends Model {
};
__decorate([
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], Transactions.prototype, "pool_id", void 0);
__decorate([
    BelongsTo(() => Pool)
], Transactions.prototype, "pool", void 0);
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], Transactions.prototype, "tx_hash", void 0);
__decorate([
    Column(DataType.INTEGER)
], Transactions.prototype, "block_number", void 0);
__decorate([
    Column(DataType.BIGINT)
], Transactions.prototype, "unixtime", void 0);
__decorate([
    Column({
        type: DataType.ENUM,
        values: Object.values(TransactionType),
    })
], Transactions.prototype, "transaction_type", void 0);
__decorate([
    Column(DataType.STRING)
], Transactions.prototype, "trader", void 0);
__decorate([
    Column(DataType.INTEGER)
], Transactions.prototype, "position", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DECIMAL(30, 15))
], Transactions.prototype, "amount_in", void 0);
__decorate([
    AllowNull(true),
    ForeignKey(() => Coins),
    Column(DataType.INTEGER)
], Transactions.prototype, "coin_id_in", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DECIMAL(30, 15))
], Transactions.prototype, "amount_out", void 0);
__decorate([
    AllowNull(true),
    ForeignKey(() => Coins),
    Column(DataType.INTEGER)
], Transactions.prototype, "coin_id_out", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DECIMAL(30, 15))
], Transactions.prototype, "fee_usd", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DECIMAL(30, 15))
], Transactions.prototype, "value_usd", void 0);
__decorate([
    BelongsTo(() => Coins, "coin_id_in")
], Transactions.prototype, "coinIn", void 0);
__decorate([
    BelongsTo(() => Coins, "coin_id_out")
], Transactions.prototype, "coinOut", void 0);
Transactions = __decorate([
    Table({ tableName: "transactions" })
], Transactions);
export { Transactions };
//# sourceMappingURL=Transactions.js.map