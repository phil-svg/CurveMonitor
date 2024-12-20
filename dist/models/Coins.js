var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';
let Coins = class Coins extends Model {
};
__decorate([
    Index,
    Column(DataType.STRING)
], Coins.prototype, "address", void 0);
__decorate([
    Index,
    Column(DataType.STRING)
], Coins.prototype, "symbol", void 0);
__decorate([
    Index,
    Column(DataType.INTEGER)
], Coins.prototype, "decimals", void 0);
Coins = __decorate([
    Table({ tableName: 'coins' })
], Coins);
export { Coins };
//# sourceMappingURL=Coins.js.map