import express from 'express';
import { body } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { prisma } from '../config/database';
// import pushNotificationService from '../services/pushNotificationService'; // Disabled

const router = express.Router();

// Get notification settings
router.get('/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.userNotificationSettings.findUnique({
      where: { userId: req.user!.id },
    });

    res.json({ 
      settings: settings ? settings.settings : {
        // Default settings
        submissionReminders: true,
        lastHourReminder: true,
        groupActivity: true,
        newMemberJoined: true,
        memberLeftGroup: false,
        allSubmitted: true,
        mixtapeReady: true,
        playlistFailed: true,
        friendRequests: true,
        mentions: true,
        appUpdates: true,
        maintenance: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        pushNotifications: true,
        emailNotifications: false,
        smsNotifications: false,
      }
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to get notification settings' });
  }
});

// Update notification settings
router.put('/settings', 
  authenticateToken,
  [
    body().isObject(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const newSettings = req.body;

      await prisma.userNotificationSettings.upsert({
        where: { userId },
        update: { 
          settings: newSettings,
        },
        create: {
          userId,
          settings: newSettings,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({ error: 'Failed to update notification settings' });
    }
  }
);

// Push notifications temporarily disabled

// Test notifications temporarily disabled

export default router;