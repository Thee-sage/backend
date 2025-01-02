"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletRequest = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// Create the WalletRequest schema
const walletRequestSchema = new mongoose_1.default.Schema({
    uid: { type: String, required: true },
    email: { type: String, required: true },
    requestedAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    signedBy: { type: String, default: null }, // Will store admin's email
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Create and export the WalletRequest model
exports.WalletRequest = mongoose_1.default.model('WalletRequest', walletRequestSchema);
