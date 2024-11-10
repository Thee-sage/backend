import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { User, Wallet } from '../models';
import mongoose from 'mongoose';

const router = express.Router();
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

function generateDatabaseUid() {
  return new mongoose.Types.ObjectId().toString();
}

// Regular login route
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

// Google OAuth route
router.post('/callback', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as TokenPayload;
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const { email, given_name: firstName, family_name: lastName } = payload;
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        uid: generateDatabaseUid(),
        verified: true,
        role: "customer",
        authProvider: 'google'
      });
      await user.save();

      const wallet = new Wallet({ uid: user.uid, email: user.email });
      await wallet.save();
    }

    let wallet = await Wallet.findOne({ uid: user.uid });
    if (!wallet) {
      wallet = new Wallet({ uid: user.uid, email: user.email });
      await wallet.save();
    }

    const jwtToken = createJwtToken(user.uid, user.email);

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
  } catch (error: any) {  // Type assertion for error
    console.error("Error during Google login:", error);
    
    // Check if error is an object with a message property
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
});

export default router;