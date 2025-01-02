"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String },
    uid: { type: String, required: true },
    role: { type: String, default: 'customer' },
    createdAt: { type: Date, default: Date.now },
});
// Use this pattern to avoid the OverwriteModelError
exports.User = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
