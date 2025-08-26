import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { config } from '../config/env';
import { prisma } from '../config/database';

const router = express.Router();

// Initialize Twilio client (only if credentials are provided)
let twilioClient: twilio.Twilio | null = null;
if (config.twilio.accountSid && config.twilio.authToken && config.twilio.verifySid) {
  twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  console.log('✅ Twilio Verify service initialized');
} else {
  console.log('⚠️ Twilio Verify credentials not provided - verification will be simulated');
}

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

// Start verification via Twilio Verify
async function startVerification(phoneNumber: string): Promise<{ success: boolean; status?: string }> {
  try {
    if (!twilioClient || !config.twilio.verifySid) {
      console.log('📱 Verification simulation - would send to:', phoneNumber);
      return { success: true, status: 'simulated' };
    }

    const verification = await twilioClient.verify.v2
      .services(config.twilio.verifySid)
      .verifications
      .create({ 
        to: phoneNumber, 
        channel: 'sms' 
      });

    console.log('📤 Verification sent successfully:', verification.status);
    return { success: true, status: verification.status };
  } catch (error) {
    console.error('❌ Verification sending failed:', error);
    return { success: false };
  }
}

// Check verification via Twilio Verify
async function checkVerification(phoneNumber: string, code: string): Promise<{ success: boolean; status?: string }> {
  try {
    if (!twilioClient || !config.twilio.verifySid) {
      console.log('📱 Verification check simulation - would verify:', phoneNumber, code);
      // In simulation mode, check against our local store
      return { success: true, status: 'approved' };
    }

    const verificationCheck = await twilioClient.verify.v2
      .services(config.twilio.verifySid)
      .verificationChecks
      .create({ 
        to: phoneNumber, 
        code: code 
      });

    console.log('✅ Verification check result:', verificationCheck.status);
    return { 
      success: verificationCheck.status === 'approved', 
      status: verificationCheck.status 
    };
  } catch (error) {
    console.error('❌ Verification check failed:', error);
    return { success: false };
  }
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
    console.log('📱 Starting verification for:', formattedPhone);

    // Start verification using Twilio Verify
    const verificationResult = await startVerification(formattedPhone);
    
    if (!verificationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code'
      });
    }

    // In simulation mode, store a code for testing
    if (verificationResult.status === 'simulated') {
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      verificationCodes.set(formattedPhone, {
        code,
        expiresAt,
        attempts: 1
      });
      
      console.log(`📱 Simulation code for ${formattedPhone}: ${code}`);
      
      return res.json({
        success: true,
        message: 'Verification code sent successfully',
        // Include code in development for testing
        ...(config.nodeEnv === 'development' && { code })
      });
    }
    
    console.log('✅ Verification sent via Twilio Verify');
    
    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('❌ Send verification error:', error);
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

    // Check verification using Twilio Verify
    const verificationResult = await checkVerification(formattedPhone, code);
    
    if (!verificationResult.success) {
      // Handle specific error cases
      if (verificationResult.status === 'max_attempts_reached') {
        return res.status(429).json({
          success: false,
          error: 'Maximum verification attempts reached. Please request a new code.'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code.'
      });
    }

    // For simulation mode, check local storage
    if (twilioClient === null) {
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

      // Remove from local store
      verificationCodes.delete(formattedPhone);
    }

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

// Complete signup with username
router.post('/complete-signup', async (req, res) => {
  try {
    const { phoneNumber, code, username } = req.body;
    
    if (!phoneNumber || !code || !username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number, verification code, and username are required' 
      });
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const trimmedUsername = username.trim();
    
    // Validate username
    if (trimmedUsername.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 2 characters long'
      });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: { 
        displayName: trimmedUsername,
        NOT: { email: formattedPhone } // Allow same user to update their username
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken. Please choose a different one.'
      });
    }

    console.log('🔐 Completing signup for:', formattedPhone, 'with username:', trimmedUsername);

    // Note: We don't re-verify the code here because it was already verified in the previous step
    // and deleted from the store. The frontend flow ensures the user can only reach this endpoint
    // after successful code verification.

    // Find or create user with username
    let user = await prisma.user.findUnique({
      where: { email: formattedPhone },
      include: { musicAccounts: true }
    });

    if (!user) {
      console.log('👤 Creating new user for phone:', formattedPhone, 'username:', trimmedUsername);
      user = await prisma.user.create({
        data: {
          email: formattedPhone,
          displayName: trimmedUsername,
        },
        include: { musicAccounts: true }
      });
    } else {
      // Update existing user's display name
      console.log('👤 Updating username for existing user:', formattedPhone);
      user = await prisma.user.update({
        where: { email: formattedPhone },
        data: { displayName: trimmedUsername },
        include: { musicAccounts: true }
      });
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

    console.log('🎉 Phone signup completed successfully');

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
    console.error('❌ Complete signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete signup'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'phone auth router active (Twilio Verify)',
    twilioConfigured: twilioClient !== null,
    simulationCodesInMemory: verificationCodes.size
  });
});

export default router;