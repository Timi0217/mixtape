import express from 'express';
import { body } from 'express-validator';
import { UserService } from '../services/userService';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { validateRequest } from '../utils/validation';

const router = express.Router();

router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('displayName').trim().isLength({ min: 1, max: 50 }),
    body('timezone').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, displayName, timezone } = req.body;

      const existingUser = await UserService.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      const user = await UserService.createUser({
        email,
        displayName,
        timezone,
      });

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
      });

      res.status(201).json({
        user,
        tokens,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await UserService.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
      });

      res.json({
        user,
        tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.post('/refresh',
  [
    body('refreshToken').notEmpty(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      const payload = verifyRefreshToken(refreshToken);
      
      const user = await UserService.getUserByEmail(payload.email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
      });

      res.json({ tokens });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

// OAuth endpoints have been moved to /routes/oauth.ts
// This file now only handles JWT token refresh

export default router;