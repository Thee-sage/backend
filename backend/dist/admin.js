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
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const models_1 = require("./models");
const adminauthenticationmiddleware_1 = require("./middlewares/adminauthenticationmiddleware");
const router = express_1.default.Router();
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
const ADMIN_APPROVAL_PASSWORD_HASH = process.env.ADMIN_APPROVAL_PASSWORD_HASH || '';
const POSITION_SYMBOLS = ['^', '#', '$', '%'];
const OTP_EXPIRATION_TIME = 1800000; // 30 minutes
// Temporary in-memory storage for OTPs
const otpStore = {};
// Helper to generate OTP parts
function generateOtpParts() {
    const otp = crypto_1.default.randomInt(100000000000, 999999999999).toString();
    const otpParts = [];
    for (let i = 0; i < 4; i++) {
        const part = otp.slice(i * 3, (i + 1) * 3);
        const symbol = POSITION_SYMBOLS[i];
        const hashedPart = bcrypt_1.default.hashSync(`${part}${symbol}`, 10);
        otpParts.push({ part, symbol, hashedPart });
    }
    return otpParts;
}
// Assign parts to emails
function assignOtpParts(otpParts) {
    const shuffledParts = [...otpParts];
    shuffledParts.sort(() => Math.random() - 0.5);
    return [
        { parts: [shuffledParts[0], shuffledParts[1]] },
        { parts: [shuffledParts[2], shuffledParts[3]] },
    ];
}
router.post('/request-upgrade', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid } = req.body;
    try {
        const userToUpgrade = yield models_1.User.findOne({ uid });
        if (!userToUpgrade) {
            return res.status(404).json({ message: 'User not found' });
        }
        const otpParts = generateOtpParts();
        otpStore[uid] = { parts: otpParts, expiresAt: Date.now() + OTP_EXPIRATION_TIME };
        const emailAssignments = assignOtpParts(otpParts);
        const adminEmails = yield models_1.User.find({ role: 'admin' }).distinct('email');
        if (adminEmails.length < 2) {
            return res.status(500).json({ message: 'Not enough admin emails configured' });
        }
        // Send two parts to each admin email
        for (let i = 0; i < emailAssignments.length; i++) {
            const { parts } = emailAssignments[i];
            const emailContent = parts
                .map(part => `<p>OTP Part ${part.symbol}: ${part.part}</p>`)
                .join('');
            yield transporter.sendMail({
                from: process.env.CPANELEMAIL_USER,
                to: adminEmails[i],
                subject: 'Admin Upgrade OTP',
                html: emailContent,
            });
        }
        setTimeout(() => delete otpStore[uid], OTP_EXPIRATION_TIME);
        res.status(200).json({ message: 'OTP sent to admins for approval' });
    }
    catch (err) {
        console.error('Error during admin upgrade request:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.post('/upgrade-to-admin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid, otp, password } = req.body;
    try {
        const storedOtpData = otpStore[uid];
        if (!storedOtpData) {
            return res.status(400).json({ message: 'OTP expired or invalid' });
        }
        // Validate OTP
        for (let i = 0; i < storedOtpData.parts.length; i++) {
            const inputPart = otp.slice(i * 3, (i + 1) * 3);
            const expectedHash = storedOtpData.parts[i].hashedPart;
            const isMatch = bcrypt_1.default.compareSync(`${inputPart}${storedOtpData.parts[i].symbol}`, expectedHash);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid OTP' });
            }
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, ADMIN_APPROVAL_PASSWORD_HASH);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        const userToUpgrade = yield models_1.User.findOne({ uid });
        if (!userToUpgrade) {
            return res.status(404).json({ message: 'User not found' });
        }
        userToUpgrade.role = 'admin';
        yield userToUpgrade.save();
        delete otpStore[uid];
        res.status(200).json({ message: 'User upgraded to admin' });
    }
    catch (err) {
        console.error('Error during admin upgrade process:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.post('/admin-login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { identifier, password } = req.body;
    try {
        const user = yield models_1.User.findOne({
            $or: [
                { email: identifier },
                { uid: identifier }
            ]
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
        const otp = crypto_1.default.randomInt(100000, 999999).toString();
        const hashedOtp = bcrypt_1.default.hashSync(otp, 10);
        otpStore[user.email] = {
            hashedPart: hashedOtp,
            part: otp,
            symbol: '',
            expiresAt: Date.now() + OTP_EXPIRATION_TIME
        };
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER,
            to: user.email,
            subject: 'Admin Login OTP',
            html: `
        <h2>Your OTP for Admin Login</h2>
        <p>Please use the following OTP to complete your login: <strong>${otp}</strong></p>
        <p>This OTP is valid for 30 minutes.</p>
      `,
        });
        res.status(200).json({
            message: 'OTP sent to your email for verification',
            email: user.email
        });
    }
    catch (err) {
        console.error('Error during admin login:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
router.post('/verify-otp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp } = req.body;
    console.log('Received OTP verification request:', { email, otp });
    try {
        const storedOtpData = otpStore[email];
        if (!storedOtpData) {
            console.log('No OTP data found for email:', email);
            return res.status(400).json({ message: 'OTP expired or invalid' });
        }
        console.log('OTP expiration check:', {
            currentTime: Date.now(),
            expirationTime: storedOtpData.expiresAt,
            isExpired: Date.now() > storedOtpData.expiresAt
        });
        if (Date.now() > storedOtpData.expiresAt) {
            console.log('OTP expired for email:', email);
            delete otpStore[email];
            return res.status(400).json({ message: 'OTP expired' });
        }
        console.log('Validating OTP:', {
            providedOtp: otp,
            storedHash: storedOtpData.hashedPart
        });
        const isOtpValid = bcrypt_1.default.compareSync(otp, storedOtpData.hashedPart);
        if (!isOtpValid) {
            console.log('Invalid OTP provided for email:', email);
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        console.log('OTP verified successfully for email:', email);
        const user = yield models_1.User.findOne({ email });
        if (!user) {
            console.log('User not found for verified OTP:', email);
            return res.status(404).json({ message: 'User not found' });
        }
        const token = jsonwebtoken_1.default.sign({
            uid: user.uid,
            email: user.email,
            role: user.role
        }, process.env.JWT_SECRET || '', { expiresIn: '1h' });
        delete otpStore[email];
        return res.status(200).json({
            message: 'OTP verified, login successful',
            token,
            uid: user.uid,
            email: user.email
        });
    }
    catch (err) {
        console.error('Error during OTP verification:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}));
router.get('/dashboard', adminauthenticationmiddleware_1.verifyAdminAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const adminData = yield models_1.User.findOne({ uid: req.body.uid });
        res.status(200).json({
            message: 'Admin dashboard access granted',
            adminData
        });
    }
    catch (err) {
        console.error('Error accessing admin dashboard:', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;
