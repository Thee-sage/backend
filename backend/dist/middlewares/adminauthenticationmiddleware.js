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
exports.verifyAdminAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const JWT_SECRET = process.env.JWT_SECRET || '';
const verifyAdminAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = yield models_1.User.findOne({ uid: decoded.uid });
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
            }
            // Attach admin info to request object
            req.admin = {
                uid: decoded.uid,
                email: decoded.email,
                role: decoded.role
            };
            next();
        }
        catch (jwtError) {
            const error = jwtError;
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            return res.status(401).json({ message: 'Invalid token' });
        }
    }
    catch (err) {
        console.error('Error in admin middleware:', err);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.verifyAdminAuth = verifyAdminAuth;
exports.default = exports.verifyAdminAuth;
