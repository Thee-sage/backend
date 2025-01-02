"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const gameSettingsSchema = new mongoose_1.Schema({
    ballLimit: { type: Number, default: 100 },
    initialBalance: { type: Number, default: 200 },
    maxBallPrice: { type: Number, default: 20 },
    dropResetTime: { type: Number, default: 60000 },
    totalCycleTime: { type: Number, default: 600000 }, // 10 minutes in milliseconds
    lastSignedInBy: { type: String, required: true }
}, {
    timestamps: true
});
// Ensure only one settings document exists
gameSettingsSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = this.constructor;
        if (this.isNew) {
            const count = yield settings.countDocuments();
            if (count > 0) {
                next(new Error('Only one settings document can exist'));
            }
        }
        next();
    });
});
exports.GameSettings = mongoose_1.default.model('GameSettings', gameSettingsSchema);