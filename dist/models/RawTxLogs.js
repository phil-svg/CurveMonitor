var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import { Pool } from "./Pools.js";
let RawTxLogs = class RawTxLogs extends Model {
};
__decorate([
    ForeignKey(() => Pool),
    Column(DataType.INTEGER)
], RawTxLogs.prototype, "pool_id", void 0);
__decorate([
    Column(DataType.STRING)
], RawTxLogs.prototype, "address", void 0);
__decorate([
    Column({
        field: "block_number",
        type: DataType.INTEGER,
    })
], RawTxLogs.prototype, "blockNumber", void 0);
__decorate([
    Column({
        field: "transaction_hash",
        type: DataType.STRING,
    })
], RawTxLogs.prototype, "transactionHash", void 0);
__decorate([
    Column({
        field: "transaction_index",
        type: DataType.INTEGER,
    })
], RawTxLogs.prototype, "transactionIndex", void 0);
__decorate([
    Column({
        field: "block_hash",
        type: DataType.STRING,
    })
], RawTxLogs.prototype, "blockHash", void 0);
__decorate([
    Column(DataType.INTEGER)
], RawTxLogs.prototype, "logIndex", void 0);
__decorate([
    Column(DataType.BOOLEAN)
], RawTxLogs.prototype, "removed", void 0);
__decorate([
    Column(DataType.STRING)
], RawTxLogs.prototype, "log_id", void 0);
__decorate([
    Column(DataType.JSON)
], RawTxLogs.prototype, "returnValues", void 0);
__decorate([
    Column(DataType.STRING)
], RawTxLogs.prototype, "event", void 0);
__decorate([
    Column(DataType.STRING)
], RawTxLogs.prototype, "signature", void 0);
__decorate([
    Column(DataType.JSON)
], RawTxLogs.prototype, "raw", void 0);
__decorate([
    BelongsTo(() => Pool)
], RawTxLogs.prototype, "pool", void 0);
RawTxLogs = __decorate([
    Table({
        tableName: "raw_tx_logs",
        indexes: [
            {
                name: "unique_blockhash_logindex",
                unique: true,
                fields: ["block_hash", "logIndex"],
            },
        ],
    })
], RawTxLogs);
export { RawTxLogs };
//# sourceMappingURL=RawTxLogs.js.map