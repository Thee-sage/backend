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
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const models_1 = require("./models");
const OtpToken_1 = __importDefault(require("./models/OtpToken"));
const authMiddleware_1 = __importDefault(require("./middlewares/authMiddleware"));
dotenv_1.default.config();
const router = express_1.default.Router();
// Nodemailer transporter configuration using env variables
const transporter = nodemailer_1.default.createTransport({
    host: process.env.CPANELEMAIL_HOST,
    port: parseInt(process.env.CPANELEMAIL_PORTOUT || '587'),
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
router.get('/user/:uid', authMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { uid } = req.params;
    const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
    const currentUserRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    console.log(`Received UID in request: ${uid}`);
    console.log(`Current User ID: ${currentUserId}, Role: ${currentUserRole}`);
    if (!currentUserId || (currentUserId !== uid && currentUserRole !== 'admin')) {
        console.log('Access denied: User not authorized');
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const user = yield models_1.User.findOne({ uid }, { firstName: 1, lastName: 1, email: 1, role: 1, uid: 1 });
        console.log(`User found in database:`, user);
        if (!user) {
            console.log('No user found with the provided UID');
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    }
    catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// Initiate account deletion process with OTP
router.post('/delete-account-initiate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid, password } = req.body;
    try {
        const user = yield models_1.User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role !== 'customer') {
            return res.status(403).json({ message: 'Admin accounts cannot be deleted' });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Incorrect password' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpToken = new OtpToken_1.default({
            uid,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        });
        yield otpToken.save();
        // Send OTP via email
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER,
            to: user.email,
            subject: 'Account Deletion OTP',
            html: `<p>Your OTP for account deletion is: <b>${otp}</b>. It expires in 10 minutes.</p>`,
        });
        res.status(200).json({ message: 'OTP sent to your email for verification.' });
    }
    catch (err) {
        console.error('Error during delete initiation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// Confirm account deletion with OTP
router.post('/verify-delete', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid, otp } = req.body;
    try {
        const otpToken = yield OtpToken_1.default.findOne({ uid, otp });
        if (!otpToken || otpToken.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        yield models_1.User.findOneAndDelete({ uid });
        yield models_1.Wallet.findOneAndDelete({ uid });
        yield OtpToken_1.default.deleteOne({ uid, otp });
        res.status(200).json({ message: 'User and associated wallet deleted successfully' });
    }
    catch (err) {
        console.error('Error during delete confirmation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// Request password reset with OTP
router.post('/password-reset-request', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    try {
        const user = yield models_1.User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpToken = new OtpToken_1.default({
            uid: user.uid,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        });
        yield otpToken.save();
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: `<p>Your OTP for password reset is: <b>${otp}</b>. It expires in 10 minutes.</p>`,
        });
        res.status(200).json({ message: 'OTP sent to your email for password reset.' });
    }
    catch (err) {
        console.error('Error during password reset request:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// Confirm password reset and update password
router.post('/password-reset-confirm', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp, newPassword } = req.body;
    try {
        const user = yield models_1.User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const otpToken = yield OtpToken_1.default.findOne({ uid: user.uid, otp });
        if (!otpToken || otpToken.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        user.password = yield bcrypt_1.default.hash(newPassword, 10);
        yield user.save();
        yield OtpToken_1.default.deleteOne({ uid: user.uid, otp });
        res.status(200).json({ message: 'Password updated successfully' });
    }
    catch (err) {
        console.error('Error during password reset confirmation:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;
