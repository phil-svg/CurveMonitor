var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index } from "sequelize-typescript";
import { Coins } from "../../models/Coins.js";
let FirstPriceTimestamp = class FirstPriceTimestamp extends Model {
};
__decorate([
    Index,
    ForeignKey(() => Coins),
    Column({
        field: "coin_id",
        type: DataType.INTEGER,
        allowNull: false,
    })
], FirstPriceTimestamp.prototype, "coinId", void 0);
__decorate([
    BelongsTo(() => Coins)
], FirstPriceTimestamp.prototype, "coin", void 0);
__decorate([
    Column({
        field: "first_timestamp_defillama",
        type: DataType.DATE,
        allowNull: true,
    })
], FirstPriceTimestamp.prototype, "firstTimestampDefillama", void 0);
FirstPriceTimestamp = __decorate([
    Table({
        tableName: "first_price_timestamp",
    })
], FirstPriceTimestamp);
export { FirstPriceTimestamp };
//# sourceMappingURL=FirstTokenPrices.js.map