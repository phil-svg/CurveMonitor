var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// pools.ts
import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, CreatedAt, AllowNull, HasMany, HasOne, } from 'sequelize-typescript';
import { PoolParamsEvents } from './PoolParamsEvents.js';
import { InitialParams } from './InitialParams.js';
import { Bytecode } from './PoolsByteCode.js';
export var PoolVersion;
(function (PoolVersion) {
    PoolVersion["v1"] = "v1";
    PoolVersion["v2"] = "v2";
})(PoolVersion || (PoolVersion = {}));
let Pool = class Pool extends Model {
};
__decorate([
    PrimaryKey,
    AutoIncrement,
    Column(DataType.INTEGER)
], Pool.prototype, "id", void 0);
__decorate([
    Column(DataType.STRING)
], Pool.prototype, "address", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING)
], Pool.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER)
], Pool.prototype, "n_coins", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.ARRAY(DataType.STRING))
], Pool.prototype, "coins", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING)
], Pool.prototype, "lp_token", void 0);
__decorate([
    AllowNull(true),
    Column({
        type: DataType.ENUM,
        values: Object.values(PoolVersion),
    })
], Pool.prototype, "version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING)
], Pool.prototype, "base_pool", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING)
], Pool.prototype, "source_address", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER)
], Pool.prototype, "inception_block", void 0);
__decorate([
    AllowNull(true),
    Column({
        field: 'creation_timestamp',
        type: DataType.INTEGER,
    })
], Pool.prototype, "creation_timestamp", void 0);
__decorate([
    AllowNull(true),
    CreatedAt,
    Column({
        field: 'creation_date',
        type: DataType.DATE,
    })
], Pool.prototype, "creation_date", void 0);
__decorate([
    HasMany(() => PoolParamsEvents)
], Pool.prototype, "poolParams", void 0);
__decorate([
    HasOne(() => InitialParams)
], Pool.prototype, "initialParams", void 0);
__decorate([
    HasOne(() => Bytecode)
], Pool.prototype, "bytecode", void 0);
Pool = __decorate([
    Table({ tableName: 'pools' })
], Pool);
export { Pool };
//# sourceMappingURL=Pools.js.map