"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFileSafely = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const formatFile_1 = require("./formatFile");
const writeIndexFile_1 = require("./writeIndexFile");
const writeFileSafely = async (writeLocation, content, addToIndex = true) => {
    try {
        const dir = path_1.default.dirname(writeLocation);
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(writeLocation, await (0, formatFile_1.formatFile)(content));
        if (addToIndex) {
            (0, writeIndexFile_1.addIndexExport)(writeLocation);
        }
    }
    catch (err) {
        console.error(`[writeFileSafely] Failed to write: ${writeLocation}`);
        console.error('[writeFileSafely] Content that failed to format:');
        console.error(content);
        console.error('[writeFileSafely] Error details:');
        console.error(err);
    }
};
exports.writeFileSafely = writeFileSafely;
//# sourceMappingURL=writeFileSafely.js.map