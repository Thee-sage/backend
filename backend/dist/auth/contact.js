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
const nodemailer_1 = __importDefault(require("nodemailer"));
const express_rate_limit_1 = require("express-rate-limit");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
// Rate limiting to prevent spam
const contactLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per hour
    message: 'Too many contact requests, please try again later.'
});
// Configure nodemailer with cPanel settings
const transporter = nodemailer_1.default.createTransport({
    host: process.env.CPANELEMAIL_HOST,
    port: parseInt(process.env.CPANELEMAIL_PORTOUT || '587'), // Using SMTP port for sending
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
// Contact form submission endpoint
router.post('/send', contactLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, subject, message } = req.body;
    // Basic validation
    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            message: 'Please fill in all fields'
        });
    }
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            message: 'Please provide a valid email address'
        });
    }
    try {
        // Send email to support
        yield transporter.sendMail({
            from: process.env.CPANELEMAIL_USER, // Use authorized email as sender
            replyTo: email, // Set reply-to as the contact form submitter's email
            to: process.env.CPANELEMAIL_USER,
            subject: `Contact Form: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name} (${email})</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <h3>Message:</h3>
                <p>${message.replace(/\n/g, '<br/>')}</p>
            `
        });
        console.log('Contact form submission processed successfully', { name, email, subject });
        res.status(200).json({
            message: 'Message sent successfully! We\'ll get back to you soon.'
        });
    }
    catch (err) {
        console.error('Error processing contact form submission:', err);
        res.status(500).json({
            message: 'Failed to send message. Please try again later.'
        });
    }
}));
exports.default = router;
