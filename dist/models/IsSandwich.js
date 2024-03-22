var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, Unique } from "sequelize-typescript";
import { Transactions } from "./Transactions.js";
let IsSandwich = class IsSandwich extends Model {
};
__decorate([
    Unique,
    ForeignKey(() => Transactions),
    Index,
    Column({ type: DataType.INTEGER })
], IsSandwich.prototype, "tx_id", void 0);
__decorate([
    BelongsTo(() => Transactions)
], IsSandwich.prototype, "transaction", void 0);
__decorate([
    Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
], IsSandwich.prototype, "is_sandwich", void 0);
IsSandwich = __decorate([
    Table({ tableName: "is_sandwich" })
], IsSandwich);
export { IsSandwich };
//# sourceMappingURL=IsSandwich.js.map