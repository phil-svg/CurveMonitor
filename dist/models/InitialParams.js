var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// InitialParams.ts
import { Model, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, DataType, BelongsTo } from "sequelize-typescript";
import { Pool } from "./Pools.js";
let InitialParams = class InitialParams extends Model {
};
__decorate([
    PrimaryKey,
    AutoIncrement,
    Column(DataType.INTEGER)
], InitialParams.prototype, "id", void 0);
__decorate([
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], InitialParams.prototype, "pool_id", void 0);
__decorate([
    BelongsTo(() => Pool)
], InitialParams.prototype, "pool", void 0);
__decorate([
    Column(DataType.STRING)
], InitialParams.prototype, "A", void 0);
__decorate([
    Column(DataType.STRING)
], InitialParams.prototype, "fee", void 0);
__decorate([
    Column(DataType.STRING)
], InitialParams.prototype, "gamma", void 0);
InitialParams = __decorate([
    Table({ tableName: "initial_params" })
], InitialParams);
export { InitialParams };
//# sourceMappingURL=InitialParams.js.map