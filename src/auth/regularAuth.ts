// auth/index.ts
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { User, Wallet } from '../models';

const router = express.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const JWT_SECRET = process.env.JWT_SECRET as string;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                role: string;
            };
        }
    }
}

interface CustomJwtPayload extends jwt.JwtPayload {
    uid: string;
}

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Helper Functions
function createJwtToken(uid: string, email: string) {
    return jwt.sign(
        { uid, email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function generateDatabaseUid() {
    return new mongoose.Types.ObjectId().toString();
}

// Middleware
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;
        const user = await User.findOne({ uid: decoded.uid });
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid token or user not found' });
        }

        req.user = {
            uid: user.uid,
            role: user.role,
        };

        next();
    } catch (err) {
        console.error('Authentication error:', err);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Regular Authentication Routes

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    console.log("Login request received", { email });

    try {
        const user = await User.findOne({ email });
        console.log("User found during login:", user);

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.verified) {
            console.log("User has not verified email:", email);
            return res.status(400).json({ message: 'Please verify your email before logging in' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log("Password validation result:", isPasswordValid);

        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        let wallet = await Wallet.findOne({ uid: user.uid });
        console.log("Wallet found for user with UID:", user.uid, "Wallet details:", wallet);

        if (!wallet) {
            wallet = new Wallet({ uid: user.uid, email: user.email });
            await wallet.save();
            console.log("New wallet created for user during login with UID:", user.uid);
        }

        const token = createJwtToken(user.uid, user.email);

        console.log("Login successful for user:", email);
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
    } catch (err) {
        console.error('Error during login process:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const uid = crypto.randomUUID();

        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            verificationToken,
            uid,
            verified: false,
            role: "customer"
        });
        await newUser.save();

        // Create wallet
        const newWallet = new Wallet({ uid, email });
        await newWallet.save();

        // Construct verification URL using BASE_URL
        const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
        
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
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
    } catch (err) {
        console.error('Error during sign-up process:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fixed verification route
router.get('/verify-email', async (req, res) => {
    const { token, email } = req.query;

    console.log("Verification attempt received:", { token, email });

    if (!token || !email) {
        console.log("Missing token or email in verification request");
        return res.status(400).json({ message: 'Invalid verification link' });
    }

    try {
        const user = await User.findOne({
            email: email as string,
            verificationToken: token as string
        });

        if (!user) {
            console.log("No user found with matching email and token");
            return res.status(400).json({ message: 'Invalid verification link' });
        }

        // Update user verification status
        user.verified = true;
        user.verificationToken = ''; // Clear the token
        await user.save();

        console.log("User verified successfully:", email);

        // Redirect to frontend with success parameter
        res.redirect(`${FRONTEND_URL}/complete?verified=true`);
    } catch (err) {
        console.error('Error during verification:', err);
        res.redirect(`${FRONTEND_URL}/complete?error=verification-failed`);
    }
});

// Account Deletion Routes
router.post('/delete-account-initiate', authMiddleware, async (req, res) => {
    const { password } = req.body;
    const uid = req.user?.uid;

    console.log("Initiating delete account process for UID:", uid);

    try {
        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        const deleteToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = deleteToken;
        await user.save();

        const deleteVerificationUrl = `http://localhost:3001/api/verify-delete?token=${deleteToken}&uid=${uid}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Account Deletion Verification',
            html: `<p>Click <a href="${deleteVerificationUrl}">here</a> to verify account deletion.</p>`,
        });

        console.log("Account deletion verification email sent to:", user.email);
        res.status(200).json({ message: 'Verification email sent. Please check your email to confirm deletion.' });
    } catch (err) {
        console.error('Error during delete initiation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/verify-delete', async (req, res) => {
    const { token, uid } = req.query;

    console.log("Delete account verification received", { token, uid });

    try {
        const user = await User.findOne({ uid, verificationToken: token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid token or user not found' });
        }

        await User.findOneAndDelete({ uid });
        await Wallet.findOneAndDelete({ uid });
        console.log("Deleted user and associated wallet:", uid);

        res.status(200).json({ message: 'User and associated wallet deleted successfully' });
    } catch (err) {
        console.error('Error during delete confirmation process:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;