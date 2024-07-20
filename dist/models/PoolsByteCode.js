var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// Bytecode.ts
import { Table, Column, Model, ForeignKey, DataType, BelongsTo } from 'sequelize-typescript';
import { Pool } from './Pools.js';
let Bytecode = class Bytecode extends Model {
};
__decorate([
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], Bytecode.prototype, "poolId", void 0);
__decorate([
    Column(DataType.TEXT)
], Bytecode.prototype, "bytecode", void 0);
__decorate([
    BelongsTo(() => Pool)
], Bytecode.prototype, "pool", void 0);
Bytecode = __decorate([
    Table({ tableName: 'bytecode' })
], Bytecode);
export { Bytecode };
//# sourceMappingURL=PoolsByteCode.js.map