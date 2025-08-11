import express from 'express';
import { body } from 'express-validator';
import { UserService } from '../services/userService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';

const router = express.Router();

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await UserService.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

router.put('/profile',
  authenticateToken,
  [
    body('displayName').optional().trim().isLength({ min: 1, max: 50 }),
    body('timezone').optional().isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { displayName, timezone } = req.body;

      const user = await UserService.updateUser(req.user!.id, {
        displayName,
        timezone,
      });

      res.json({ user });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  }
);

router.get('/music-accounts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const accounts = await UserService.getUserMusicAccounts(req.user!.id);
    res.json({ accounts });
  } catch (error) {
    console.error('Get music accounts error:', error);
    res.status(500).json({ error: 'Failed to get music accounts' });
  }
});

router.delete('/music-accounts/:platform', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    
    await UserService.removeMusicAccount(req.user!.id, platform);
    
    res.json({ message: 'Music account disconnected successfully' });
  } catch (error) {
    console.error('Remove music account error:', error);
    res.status(500).json({ error: 'Failed to disconnect music account' });
  }
});

router.delete('/account', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await UserService.deleteUser(req.user!.id);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;