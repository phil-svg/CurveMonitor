var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// PoolParamsEvents.ts
import { Model, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, DataType, BelongsTo } from "sequelize-typescript";
import { Pool } from "./Pools.js";
let PoolParamsEvents = class PoolParamsEvents extends Model {
};
__decorate([
    PrimaryKey,
    AutoIncrement,
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "id", void 0);
__decorate([
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "pool_id", void 0);
__decorate([
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "log_index", void 0);
__decorate([
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "last_block_checked", void 0);
__decorate([
    BelongsTo(() => Pool)
], PoolParamsEvents.prototype, "pool", void 0);
__decorate([
    Column(DataType.STRING)
], PoolParamsEvents.prototype, "event_name", void 0);
__decorate([
    Column(DataType.JSON)
], PoolParamsEvents.prototype, "raw_log", void 0);
__decorate([
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "event_block", void 0);
__decorate([
    Column(DataType.INTEGER)
], PoolParamsEvents.prototype, "event_timestamp", void 0);
PoolParamsEvents = __decorate([
    Table({ tableName: "pool_params_events" })
], PoolParamsEvents);
export { PoolParamsEvents };
//# sourceMappingURL=PoolParamsEvents.js.map