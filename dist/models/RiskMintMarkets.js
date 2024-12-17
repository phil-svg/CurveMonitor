var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';
// indexes
let RiskMintMarketInfo = 
// table structure
class RiskMintMarketInfo extends Model {
};
__decorate([
    Column({
        type: DataType.STRING(42),
        allowNull: false,
    }),
    Index
], RiskMintMarketInfo.prototype, "controller", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    Index
], RiskMintMarketInfo.prototype, "blockNumber", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "band", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(30, 15),
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "amountBorrowableToken", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(30, 15),
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "amountCollatToken", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(30, 15),
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "oraclePrice", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(30, 15),
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "amountCollatTokenInUsd", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(30, 15),
        allowNull: false,
    })
], RiskMintMarketInfo.prototype, "amountFullInBandInUsd", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
    })
], RiskMintMarketInfo.prototype, "createdAt", void 0);
RiskMintMarketInfo = __decorate([
    Table({
        tableName: 'riskMintMarketInfo',
        indexes: [
            {
                unique: false,
                fields: ['controller'],
            },
            {
                unique: false,
                fields: ['blockNumber'],
            },
            {
                unique: false,
                fields: ['controller', 'blockNumber'],
            },
        ],
    })
    // table structure
], RiskMintMarketInfo);
export { RiskMintMarketInfo };
//# sourceMappingURL=RiskMintMarkets.js.map