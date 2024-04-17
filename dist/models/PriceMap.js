var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import { Coins } from './Coins.js';
let PriceMap = class PriceMap extends Model {
};
__decorate([
    Index,
    ForeignKey(() => Coins),
    Column({
        field: 'coin_id',
        type: DataType.INTEGER,
        allowNull: false,
    })
], PriceMap.prototype, "coin_id", void 0);
__decorate([
    BelongsTo(() => Coins)
], PriceMap.prototype, "coin", void 0);
__decorate([
    Column({
        field: 'coin_price_usd',
        type: DataType.DECIMAL(20, 10),
        allowNull: false,
        validate: {
            isLessThanOneBillion(value) {
                if (value >= 1e9) {
                    throw new Error('coinPriceUsd must be less than 1 billion USD');
                }
            },
        },
    })
], PriceMap.prototype, "coinPriceUsd", void 0);
__decorate([
    Column({
        field: 'price_timestamp',
        type: DataType.INTEGER,
        allowNull: false,
    })
], PriceMap.prototype, "priceTimestamp", void 0);
PriceMap = __decorate([
    Table({
        tableName: 'price_map',
    })
], PriceMap);
export { PriceMap };
//# sourceMappingURL=PriceMap.js.map