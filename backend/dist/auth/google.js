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
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const models_1 = require("../models");
const mongoose_1 = __importDefault(require("mongoose"));
const router = express_1.default.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const client = new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID);
// Helper function to create a JWT
function createJwtToken(uid, email) {
    return jsonwebtoken_1.default.sign({ uid, email }, JWT_SECRET, { expiresIn: '1h' });
}
function generateDatabaseUid() {
    return new mongoose_1.default.Types.ObjectId().toString();
}
// Google OAuth route with verification check
router.post('/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.body;
    if (!token) {
        console.log('Google login attempt failed: No token provided');
        return res.status(400).json({ error: 'No token provided' });
    }
    try {
        const ticket = yield client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            console.log('Google login attempt failed: Invalid payload');
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        const { email, given_name: firstName, family_name: lastName } = payload;
        let user = yield models_1.User.findOne({ email }).select('+verified');
        if (!user) {
            // For new Google users, create account with verified true
            user = new models_1.User({
                email,
                firstName: firstName || '',
                lastName: lastName || '',
                uid: generateDatabaseUid(),
                verified: true, // Google accounts are pre-verified
                role: "customer",
                authProvider: 'google'
            });
            yield user.save();
        }
        else {
            // For existing users, check verification status
            if (user.verified === false) {
                console.log('Google login blocked: Unverified user', { email });
                return res.status(403).json({
                    error: 'Please verify your email before logging in',
                    needsVerification: true
                });
            }
        }
        let wallet = yield models_1.Wallet.findOne({ uid: user.uid });
        if (!wallet) {
            wallet = new models_1.Wallet({ uid: user.uid, email: user.email });
            yield wallet.save();
        }
        const jwtToken = createJwtToken(user.uid, user.email);
        console.log('Google login successful', { email, verified: user.verified });
        res.status(200).json({
            token: jwtToken,
            uid: user.uid,
            email: user.email,
            balance: wallet.balance || 20,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error("Error during Google login:", error);
        if (error && typeof error === 'object' && 'message' in error) {
            if (error.message.includes('audience mismatch')) {
                return res.status(401).json({
                    error: 'Invalid client ID configuration',
                    details: 'Please check your Google OAuth client ID configuration'
                });
            }
        }
        res.status(401).json({ error: 'Authentication failed' });
    }
}));
exports.default = router;
