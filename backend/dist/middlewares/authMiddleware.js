"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // Import JwtPayload
const models_1 = require("../models"); // Import your User model
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1]; // Assuming 'Bearer <token>' format
    if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET); // Cast to CustomJwtPayload
        // Now you can safely access `uid`
        const user = yield models_1.User.findOne({ uid: decoded.uid });
        if (!user) {
            return res.status(401).json({ message: 'Invalid token or user not found' });
        }
        req.user = {
            uid: user.uid,
            role: user.role,
        };
        next(); // Proceed to the next middleware or route handler
    }
    catch (err) {
        console.error('Authentication error:', err);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
});
exports.default = authMiddleware;
