import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User } from './models';
import { verifyAdminAuth } from './middlewares/adminauthenticationmiddleware';

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

const ADMIN_APPROVAL_PASSWORD_HASH = process.env.ADMIN_APPROVAL_PASSWORD_HASH || '';
const POSITION_SYMBOLS = ['^', '#', '$', '%'];
const OTP_EXPIRATION_TIME = 1800000; // 30 minutes

interface OtpPart {
  part: string;
  symbol: string;
  hashedPart: string;
}
interface OtpData {
  parts: OtpPart[];
  expiresAt: number;
}
interface LoginOtpData {
  hashedPart: string;
  part: string;
  symbol: string;
  expiresAt: number;
}

// Temporary in-memory storage for OTPs
const otpStore: Record<string, OtpData | LoginOtpData> = {};

// Helper to generate OTP parts
function generateOtpParts(): OtpPart[] {
  const otp = crypto.randomInt(100000000000, 999999999999).toString(); // Generate a 12-digit OTP

  const otpParts: OtpPart[] = [];
  for (let i = 0; i < 4; i++) {
    const part = otp.slice(i * 3, (i + 1) * 3); // Extract each 3-digit part
    const symbol = POSITION_SYMBOLS[i];
    const hashedPart = bcrypt.hashSync(`${part}${symbol}`, 10);
    otpParts.push({ part, symbol, hashedPart });
  }

  return otpParts;
}

// Assign parts to emails
function assignOtpParts(otpParts: OtpPart[]) {
  const shuffledParts = [...otpParts];
  shuffledParts.sort(() => Math.random() - 0.5); // Shuffle parts
  return [
    { parts: [shuffledParts[0], shuffledParts[1]] },
    { parts: [shuffledParts[2], shuffledParts[3]] },
  ];
}

router.post('/request-upgrade', async (req: Request, res: Response) => {
  const { uid } = req.body;

  try {
    const userToUpgrade = await User.findOne({ uid });
    if (!userToUpgrade) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otpParts = generateOtpParts();
    otpStore[uid] = { parts: otpParts, expiresAt: Date.now() + OTP_EXPIRATION_TIME };

    // Assign OTP parts and send to admin emails
    const emailAssignments = assignOtpParts(otpParts);
    const adminEmails = await User.find({ role: 'admin' }).distinct('email');
    if (adminEmails.length < 2) {
      return res.status(500).json({ message: 'Not enough admin emails configured' });
    }

    // Send two parts to each admin email
    for (let i = 0; i < emailAssignments.length; i++) {
      const { parts } = emailAssignments[i];
      const emailContent = parts
        .map(part => `<p>OTP Part ${part.symbol}: ${part.part}</p>`)
        .join('');

      await transporter.sendMail({
        from: process.env.EMAIL_USER || '',
        to: adminEmails[i],
        subject: 'Admin Upgrade OTP',
        html: emailContent,
      });
    }

    setTimeout(() => delete otpStore[uid], OTP_EXPIRATION_TIME); // Remove OTP after expiration time
    res.status(200).json({ message: 'OTP sent to admins for approval' });
  } catch (err) {
    console.error('Error during admin upgrade request:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upgrade-to-admin', async (req: Request, res: Response) => {
  const { uid, otp, password } = req.body;

  try {
    const storedOtpData = otpStore[uid] as OtpData;
    if (!storedOtpData) {
      return res.status(400).json({ message: 'OTP expired or invalid' });
    }

    // Validate OTP
    for (let i = 0; i < storedOtpData.parts.length; i++) {
      const inputPart = otp.slice(i * 3, (i + 1) * 3); // Extract each 3-digit part from input OTP
      const expectedHash = storedOtpData.parts[i].hashedPart;
      const isMatch = bcrypt.compareSync(`${inputPart}${storedOtpData.parts[i].symbol}`, expectedHash);
      
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
    }

    // Validate admin approval password
    const isPasswordValid = await bcrypt.compare(password, ADMIN_APPROVAL_PASSWORD_HASH);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Finalize upgrade
    const userToUpgrade = await User.findOne({ uid });
    if (!userToUpgrade) {
      return res.status(404).json({ message: 'User not found' });
    }

    userToUpgrade.role = 'admin';
    await userToUpgrade.save();

    delete otpStore[uid]; // Clean up OTP from store

    res.status(200).json({ message: 'User upgraded to admin' });
  } catch (err) {
    console.error('Error during admin upgrade process:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/admin-login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { uid: identifier }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = bcrypt.hashSync(otp, 10);
    
    // Store OTP with expiration timestamp
    otpStore[user.email] = {
      hashedPart: hashedOtp,
      part: otp,
      symbol: '',
      expiresAt: Date.now() + OTP_EXPIRATION_TIME
    };

    // Send the OTP to the admin's email
    await transporter.sendMail({
      from: process.env.EMAIL_USER || '',
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
      email: user.email  // Send back email for frontend reference
    });

  } catch (err) {
    console.error('Error during admin login:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 1. First, let's add debug logging to the OTP verification endpoint
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  console.log('Received OTP verification request:', { email, otp });

  try {
    // Check if OTP data exists
    const storedOtpData = otpStore[email] as LoginOtpData;
    if (!storedOtpData) {
      console.log('No OTP data found for email:', email);
      return res.status(400).json({ message: 'OTP expired or invalid' });
    }

    // Log OTP expiration check
    console.log('OTP expiration check:', {
      currentTime: Date.now(),
      expirationTime: storedOtpData.expiresAt,
      isExpired: Date.now() > storedOtpData.expiresAt
    });

    // Check if OTP has expired
    if (Date.now() > storedOtpData.expiresAt) {
      console.log('OTP expired for email:', email);
      delete otpStore[email];
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Log OTP validation
    console.log('Validating OTP:', {
      providedOtp: otp,
      storedHash: storedOtpData.hashedPart
    });

    const isOtpValid = bcrypt.compareSync(otp, storedOtpData.hashedPart);
    if (!isOtpValid) {
      console.log('Invalid OTP provided for email:', email);
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP verified, proceed with user lookup and token generation
    console.log('OTP verified successfully for email:', email);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for verified OTP:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: user.uid,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || '',
      { expiresIn: '1h' }
    );

    // Clean up verified OTP
    delete otpStore[email];

    return res.status(200).json({ 
      message: 'OTP verified, login successful',
      token,
      uid: user.uid,
      email: user.email
    });

  } catch (err) {
    console.error('Error during OTP verification:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/dashboard', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminData = await User.findOne({ uid: req.body.uid });
    res.status(200).json({
      message: 'Admin dashboard access granted',
      adminData
    });
  } catch (err) {
    console.error('Error accessing admin dashboard:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;