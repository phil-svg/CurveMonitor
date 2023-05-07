var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, } from 'sequelize-typescript';
let PoolCountFromProvider = class PoolCountFromProvider extends Model {
};
__decorate([
    Column(DataType.STRING)
], PoolCountFromProvider.prototype, "address", void 0);
__decorate([
    Column(DataType.INTEGER)
], PoolCountFromProvider.prototype, "count", void 0);
PoolCountFromProvider = __decorate([
    Table({ tableName: 'pool_count_from_provider' })
], PoolCountFromProvider);
export { PoolCountFromProvider };
//# sourceMappingURL=PoolCountFromProvider.js.map