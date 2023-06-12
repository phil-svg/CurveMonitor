var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType } from "sequelize-typescript";
let BlockScanningData = class BlockScanningData extends Model {
};
__decorate([
    Column({
        field: "scanned_block_range",
        type: DataType.JSON,
    })
], BlockScanningData.prototype, "scannedBlockRange", void 0);
BlockScanningData = __decorate([
    Table({
        tableName: "block_scanning_data",
    })
], BlockScanningData);
export { BlockScanningData };
//# sourceMappingURL=xxx.js.map