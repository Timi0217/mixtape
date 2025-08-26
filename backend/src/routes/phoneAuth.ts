import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../config/database';

const router = express.Router();

// In-memory store for verification codes (in production, use Redis)
const verificationCodes = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [phone, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(phone);
    }
  }
}, 5 * 60 * 1000);

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  } else if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return phone; // Return as-is if we can't format it
}

// Send verification code
router.post('/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('📱 Sending verification code to:', formattedPhone);

    // Check rate limiting - max 3 attempts per 15 minutes
    const existing = verificationCodes.get(formattedPhone);
    if (existing && existing.attempts >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please try again later.'
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code
    verificationCodes.set(formattedPhone, {
      code,
      expiresAt,
      attempts: existing ? existing.attempts + 1 : 1
    });

    // Always log the code in local development
    console.log(`📱 Verification code for ${formattedPhone}: ${code}`);

    // TODO: In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    // For now, we'll just store the code and return success
    
    console.log('✅ Verification code generated successfully');
    
    res.json({
      success: true,
      message: 'Verification code sent successfully',
      // Always include the code in response for local testing
      code: code
    });

  } catch (error) {
    console.error('❌ Send code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// Verify code and login/register user
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and verification code are required' 
      });
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('🔐 Verifying code for:', formattedPhone);

    // Check if verification code exists and is valid
    const storedData = verificationCodes.get(formattedPhone);
    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found. Please request a new code.'
      });
    }

    if (storedData.expiresAt < new Date()) {
      verificationCodes.delete(formattedPhone);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code.'
      });
    }

    // Code is valid, remove it from store
    verificationCodes.delete(formattedPhone);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: formattedPhone }, // Using phone as email for phone auth
      include: { musicAccounts: true }
    });

    if (!user) {
      console.log('👤 Creating new user for phone:', formattedPhone);
      // Create new user with phone number
      user = await prisma.user.create({
        data: {
          email: formattedPhone,
          displayName: `User ${formattedPhone.slice(-4)}`, // Default display name
        },
        include: { musicAccounts: true }
      });
    } else {
      console.log('✅ Found existing user for phone:', formattedPhone);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    console.log('🎉 Phone authentication successful');

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }
    });

  } catch (error) {
    console.error('❌ Verify code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'phone auth router active',
    codesInMemory: verificationCodes.size
  });
});

export default router;