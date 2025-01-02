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
exports.authMiddleware = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const nodemailer_1 = __importDefault(require("nodemailer"));
const models_1 = require("../models");
const router = express_1.default.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const client = new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID);
// Configure nodemailer with cPanel settings
const transporter = nodemailer_1.default.createTransport({
    host: process.env.CPANELEMAIL_HOST,
    port: parseInt(process.env.CPANELEMAIL_PORTIN || '143'),
    secure: false,
    auth: {
        user: process.env.CPANELEMAIL_USER,
        pass: process.env.CPANELEMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});
// Verify email configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.log('SMTP server connection error:', error);
    }
    else {
        console.log('SMTP server connection successful');
    }
});
// Helper Functions
function createJwtToken(uid, email) {
    return jsonwebtoken_1.default.sign({ uid, email }, JWT_SECRET, { expiresIn: '1h' });
}
// Middleware
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield models_1.User.findOne({ uid: decoded.uid });
        if (!user) {
            return res.status(401).json({ message: 'Invalid token or user not found' });
        }
        req.user = {
            uid: user.uid,
            role: user.role,
        };
        next();
    }
    catch (err) {
        console.error('Authentication error:', err);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
});
exports.authMiddleware = authMiddleware;
// Regular login route with strict verification check
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const user = yield models_1.User.findOne({ email }).select('+verified +password');
        if (!user) {
            console.log('Login attempt failed: User not found', { email });
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        if (user.verified === false) {
            console.log('Login attempt blocked: Unverified user', { email, verified: user.verified });
            return res.status(403).json({
                message: 'Please verify your email before logging in',
                needsVerification: true
            });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Login attempt failed: Invalid password', { email });
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        let wallet = yield models_1.Wallet.findOne({ uid: user.uid });
        if (!wallet) {
            wallet = new models_1.Wallet({ uid: user.uid, email: user.email });
            yield wallet.save();
        }
        const token = createJwtToken(user.uid, user.email);
        console.log('Login successful', { email, verified: user.verified });
        res.status(200).json({
            message: 'Login successful',
            token,
            uid: user.uid,
            balance: wallet.balance || 20,
            user: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (err) {
        console.error('Error during login process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.post('/signup', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, password } = req.body;
    try {
        const existingUser = yield models_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        const uid = crypto_1.default.randomUUID();
        const newUser = new models_1.User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            verificationToken,
            uid,
            verified: false,
            role: "customer"
        });
        yield newUser.save();
        const newWallet = new models_1.Wallet({ uid, email });
        yield newWallet.save();
        const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER,
            to: email,
            subject: 'Verify Your Email',
            html: `
                <h2>Welcome to Our Platform!</h2>
                <p>Please click the link below to verify your email address:</p>
                <p><a href="${verificationUrl}">Verify Email Address</a></p>
                <p>If the link doesn't work, copy and paste this URL into your browser:</p>
                <p>${verificationUrl}</p>
            `,
        });
        console.log("Verification email sent with URL:", verificationUrl);
        res.status(201).json({ message: 'User created successfully. Please check your email to verify your account.' });
    }
    catch (err) {
        console.error('Error during sign-up process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.get('/verify-email', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, email } = req.query;
    console.log("Verification attempt received:", { token, email });
    if (!token || !email) {
        console.log("Missing token or email in verification request");
        return res.status(400).json({ message: 'Invalid verification link' });
    }
    try {
        const user = yield models_1.User.findOne({
            email: email,
            verificationToken: token
        });
        if (!user) {
            console.log("No user found with matching email and token");
            return res.status(400).json({ message: 'Invalid verification link' });
        }
        user.verified = true;
        user.verificationToken = '';
        yield user.save();
        console.log("User verified successfully:", email);
        res.redirect(`${FRONTEND_URL}/complete?verified=true`);
    }
    catch (err) {
        console.error('Error during verification:', err);
        res.redirect(`${FRONTEND_URL}/complete?error=verification-failed`);
    }
}));
router.post('/delete-account-initiate', exports.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { password } = req.body;
    const uid = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
    console.log("Initiating delete account process for UID:", uid);
    try {
        const user = yield models_1.User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Incorrect password' });
        }
        const deleteToken = crypto_1.default.randomBytes(32).toString('hex');
        user.verificationToken = deleteToken;
        yield user.save();
        const deleteVerificationUrl = `${BASE_URL}/api/verify-delete?token=${deleteToken}&uid=${uid}`;
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER,
            to: user.email,
            subject: 'Account Deletion Verification',
            html: `
                <h2>Account Deletion Confirmation</h2>
                <p>Please click the link below to confirm your account deletion:</p>
                <p><a href="${deleteVerificationUrl}">Confirm Account Deletion</a></p>
                <p>If you did not request this deletion, please ignore this email and secure your account.</p>
            `,
        });
        console.log("Account deletion verification email sent to:", user.email);
        res.status(200).json({ message: 'Verification email sent. Please check your email to confirm deletion.' });
    }
    catch (err) {
        console.error('Error during delete initiation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.get('/verify-delete', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, uid } = req.query;
    console.log("Delete account verification received", { token, uid });
    try {
        const user = yield models_1.User.findOne({ uid, verificationToken: token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid token or user not found' });
        }
        yield models_1.User.findOneAndDelete({ uid });
        yield models_1.Wallet.findOneAndDelete({ uid });
        console.log("Deleted user and associated wallet:", uid);
        res.status(200).json({ message: 'User and associated wallet deleted successfully' });
    }
    catch (err) {
        console.error('Error during delete confirmation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;
