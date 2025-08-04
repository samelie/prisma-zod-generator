"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeOptionalToRequiredFields = changeOptionalToRequiredFields;
function changeOptionalToRequiredFields(inputObjectTypes) {
    inputObjectTypes.map((item) => {
        var _a, _b;
        if (item.name.includes('WhereUniqueInput') &&
            ((_b = (_a = item.constraints.fields) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0) {
            item.fields = item.fields.map((subItem) => {
                var _a;
                if ((_a = item.constraints.fields) === null || _a === void 0 ? void 0 : _a.includes(subItem.name)) {
                    return { ...subItem, isRequired: true };
                }
                return subItem;
            });
        }
        return item;
    });
}
//# sourceMappingURL=whereUniqueInput-helpers.js.map