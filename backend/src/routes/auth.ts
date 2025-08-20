import express from 'express';
import { body } from 'express-validator';
import { UserService } from '../services/userService';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { validateRequest } from '../utils/validation';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../config/database';

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

// Get current user's profile and music accounts
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        musicAccounts: {
          select: {
            id: true,
            platform: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        musicAccounts: user.musicAccounts,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Delete a music account
router.delete('/me/music/:platform', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const platform = req.params.platform;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const deletedAccount = await prisma.userMusicAccount.deleteMany({
      where: {
        userId,
        platform,
      },
    });

    if (deletedAccount.count === 0) {
      return res.status(404).json({ error: `No ${platform} account found` });
    }

    res.json({ message: `${platform} account disconnected successfully` });
  } catch (error) {
    console.error('Delete music account error:', error);
    res.status(500).json({ error: 'Failed to disconnect music account' });
  }
});

// OAuth endpoints have been moved to /routes/oauth.ts

export default router;