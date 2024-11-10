import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';

const router = express.Router();
import { User, Wallet } from './models';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const JWT_SECRET = process.env.JWT_SECRET as string;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Helper function to create a JWT
function createJwtToken(uid: string, email: string) {
  return jwt.sign(
    { uid, email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper function to generate a unique UID if needed
function generateDatabaseUid() {
  return new mongoose.Types.ObjectId().toString();
}

// Email/Password Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.verified) {
      return res.status(400).json({ message: 'Please verify your email before logging in' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let wallet = await Wallet.findOne({ uid: user.uid });
    if (!wallet) {
      wallet = new Wallet({ uid: user.uid, email: user.email });
      await wallet.save();
    }

    const token = createJwtToken(user.uid, user.email);

    res.status(200).json({ message: 'Login successful', token, uid: user.uid, balance: wallet.balance || 20 });
  } catch (err) {
    console.error('Error during login process:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google Login Route
router.post('/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as TokenPayload;
    if (!payload) {
      return res.status(401).send({ error: 'Invalid token' });
    }

    const { email, given_name: firstName, family_name: lastName } = payload;
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        firstName,
        lastName,
        uid: generateDatabaseUid(),
        verified: true,
        role: "customer",
      });
      await user.save();
    }

    if (!user.verified) {
      return res.status(403).send({ error: 'User is not verified. Please verify your email.' });
    }

    const jwtToken = createJwtToken(user.uid, user.email);

    res.send({ token: jwtToken, uid: user.uid, email: user.email });
  } catch (error) {
    console.error("Error during Google login:", error);
    res.status(401).send({ error: 'Invalid token' });
  }
});

export default router;