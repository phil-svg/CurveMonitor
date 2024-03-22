var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique, PrimaryKey } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let CexDexArbs = class CexDexArbs extends Model {
};
__decorate([
    Unique,
    PrimaryKey,
    ForeignKey(() => Transactions),
    Index,
    Column({ type: DataType.INTEGER })
], CexDexArbs.prototype, "tx_id", void 0);
__decorate([
    BelongsTo(() => Transactions)
], CexDexArbs.prototype, "transaction", void 0);
__decorate([
    Index,
    Column({ type: DataType.STRING, allowNull: true })
], CexDexArbs.prototype, "bot_address", void 0);
__decorate([
    Index,
    Column({ type: DataType.INTEGER })
], CexDexArbs.prototype, "pool_id", void 0);
CexDexArbs = __decorate([
    Table({ tableName: "cex_dex_arbs" })
], CexDexArbs);
export { CexDexArbs };
//# sourceMappingURL=CexDexArbs.js.map