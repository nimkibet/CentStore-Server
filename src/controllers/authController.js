import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { isDisposableEmail } from '../utils/disposableEmails.js';
import { sendVerificationCodeEmail } from '../utils/mailer.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: process.env.JWT_EXPIRY || '7d'
  });
};

// Register local account
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    // Disposable email defense
    if (isDisposableEmail(email)) {
      return res.status(400).json({ error: 'Disposable email addresses are not permitted.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Create verification OTP (6-digits code)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({
      name,
      email,
      password,
      authProvider: 'local',
      verificationCode,
      verificationExpires,
      isActive: false // active after OTP verification
    });

    console.log(`[AUTH] Registration initiated for ${email}. OTP Verification Code: ${verificationCode}`);

    // Send email code
    await sendVerificationCodeEmail(email, verificationCode);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent to your email.',
      email: user.email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Verify Register OTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    user.isActive = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    // Guest checkout order claiming
    const claimedCount = await Order.updateMany(
      { guestEmail: email, isGuestCheckout: true },
      { user: user._id, isGuestCheckout: false }
    );
    console.log(`Claimed ${claimedCount.modifiedCount} guest orders for new user: ${email}`);

    res.json({
      message: 'Account verified successfully.',
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Please verify your account OTP first.' });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Google OAuth Social Login
export const googleLogin = async (req, res) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({ error: 'ID token is required.' });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (!user.googleId) {
        // Link google account to existing local account
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
      }
    } else {
      // Disposable email defense check just in case
      if (isDisposableEmail(email)) {
        return res.status(400).json({ error: 'Disposable emails are blocked.' });
      }

      user = await User.create({
        name,
        email,
        googleId,
        authProvider: 'google',
        isActive: true // social logins are verified instantly
      });

      // Claim guest orders
      await Order.updateMany(
        { guestEmail: email, isGuestCheckout: true },
        { user: user._id, isGuestCheckout: false }
      );
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Google authentication failed: ' + error.message });
  }
};
