import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const router = express.Router();

import { User,Wallet } from '../models'; 



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    console.log("Login request received", { email, password });

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

        const wallet = await Wallet.findOne({ uid: user.uid });
        console.log("Wallet found for user with UID:", user.uid, "Wallet details:", wallet);

        if (!wallet) {
            const newWallet = new Wallet({ uid: user.uid, email: user.email });
            await newWallet.save();
            console.log("New wallet created for user during login with UID:", user.uid);
        }

        console.log("Login successful for user:", email);
        res.status(200).json({ message: 'Login successful', uid: user.uid, balance: wallet ? wallet.balance : 20 });
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

        // Check if a wallet exists for this email
        let existingWallet = await Wallet.findOne({ email });
        const uid = existingWallet ? existingWallet.uid : crypto.randomUUID();

        // Create and save new user with assigned uid
        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            verificationToken,
            uid,  // Assign uid here
        });
        await newUser.save();

        // Send verification email
        const verificationUrl = `http://localhost:3001/api/verify-email?token=${verificationToken}&email=${email}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Email Verification',
            html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email address.</p>`,
        });

        // If no wallet exists, create a new one
        if (!existingWallet) {
            const newWallet = new Wallet({ uid, email });
            await newWallet.save();
        }

        res.status(201).json({ message: 'User created successfully. Please check your email to verify your account.' });
    } catch (err) {
        console.error('Error during sign-up process:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/verify-email', async (req, res) => {
    const { token, email } = req.query;

    console.log("Email verification request received", { token, email });

    try {
        const user = await User.findOne({ email });
        console.log("User found for verification:", user);

        if (!user) {
            return res.status(400).json({ message: 'Invalid email' });
        }

        if (user.verificationToken === token) {
            user.verified = true;
            user.verificationToken = '';

            if (!user.uid) {
                user.uid = crypto.randomUUID();
                console.log("Generated unique UID for verified user:", user.uid);

                const newWallet = new Wallet({ uid: user.uid, email: user.email });
                await newWallet.save();
                console.log("Wallet created for user with UID:", user.uid);
            }

            await user.save();
            console.log("Email verified for user:", email);

            return res.redirect('http://localhost:5173/login');
        } else {
            console.log("Invalid verification token provided:", token);
            return res.status(400).json({ message: 'Invalid token' });
        }
    } catch (err) {
        console.error('Error during email verification process:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});



// Route to initiate account deletion
router.post('/delete-account-initiate', async (req, res) => {
    const { uid, password } = req.body;

    console.log("Initiating delete account process for UID:", uid);

    try {
        // Find user by UID
        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Generate a verification token
        const deleteToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = deleteToken;
        await user.save();

        // Send email with verification link
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

// Route to confirm and delete account
router.get('/verify-delete', async (req, res) => {
    const { token, uid } = req.query;

    console.log("Delete account verification received", { token, uid });

    try {
        // Find user by UID and token
        const user = await User.findOne({ uid, verificationToken: token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid token or user not found' });
        }

        // Delete user and associated wallet
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
