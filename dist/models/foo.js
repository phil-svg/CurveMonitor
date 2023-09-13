var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// models/ProxyCheck.ts
import { Table, Column, Model, DataType } from "sequelize-typescript";
let ProxyCheck = class ProxyCheck extends Model {
};
__decorate([
    Column({ primaryKey: true, type: DataType.STRING })
], ProxyCheck.prototype, "contractAddress", void 0);
__decorate([
    Column({ type: DataType.BOOLEAN, allowNull: true })
], ProxyCheck.prototype, "is_proxy_contract", void 0);
__decorate([
    Column({ type: DataType.STRING, allowNull: true })
], ProxyCheck.prototype, "implementation_address", void 0);
ProxyCheck = __decorate([
    Table({ tableName: "proxy_checks" })
], ProxyCheck);
export { ProxyCheck };
//# sourceMappingURL=foo.js.map