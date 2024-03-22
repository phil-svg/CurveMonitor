var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let AtomicArbs = class AtomicArbs extends Model {
};
__decorate([
    Unique,
    ForeignKey(() => Transactions),
    Column({ type: DataType.INTEGER })
], AtomicArbs.prototype, "tx_id", void 0);
__decorate([
    BelongsTo(() => Transactions)
], AtomicArbs.prototype, "transaction", void 0);
__decorate([
    Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
], AtomicArbs.prototype, "is_atomic_arb", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "net_win", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "revenue", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "bribe", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "gas_in_usd", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "total_cost", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "margin", void 0);
__decorate([
    Column({ type: DataType.INTEGER, allowNull: true })
], AtomicArbs.prototype, "position", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "gas_in_gwei", void 0);
__decorate([
    Index,
    Column({ type: DataType.STRING, allowNull: true })
], AtomicArbs.prototype, "block_builder", void 0);
__decorate([
    Column({ type: DataType.DECIMAL(30, 15), allowNull: true })
], AtomicArbs.prototype, "block_payout_to_validator", void 0);
AtomicArbs = __decorate([
    Index(["tx_id"]),
    Index(["block_builder"]),
    Table({ tableName: "atomic_arbs" })
], AtomicArbs);
export { AtomicArbs };
//# sourceMappingURL=AtomicArbs.js.map