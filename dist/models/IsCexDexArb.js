var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let IsCexDexArb = class IsCexDexArb extends Model {
};
__decorate([
    Unique,
    ForeignKey(() => Transactions),
    Index,
    Column({ type: DataType.INTEGER })
], IsCexDexArb.prototype, "tx_id", void 0);
__decorate([
    BelongsTo(() => Transactions)
], IsCexDexArb.prototype, "transaction", void 0);
__decorate([
    Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
], IsCexDexArb.prototype, "is_cex_dex_arb", void 0);
IsCexDexArb = __decorate([
    Table({ tableName: "is_cex_dex_arb" })
], IsCexDexArb);
export { IsCexDexArb };
//# sourceMappingURL=IsCexDexArb.js.map