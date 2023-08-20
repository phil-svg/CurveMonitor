var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType } from "sequelize-typescript";
let CurrentBlock = class CurrentBlock extends Model {
};
__decorate([
    Column({
        field: "block_number",
        type: DataType.INTEGER,
        allowNull: false,
    })
], CurrentBlock.prototype, "blockNumber", void 0);
CurrentBlock = __decorate([
    Table({
        tableName: "current_block",
    })
], CurrentBlock);
export { CurrentBlock };
//# sourceMappingURL=CurrentBlock.js.map