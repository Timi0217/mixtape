import express from 'express';
import { body } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { prisma } from '../config/database';
import pushNotificationService from '../services/pushNotificationService';

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

// Register push token
router.post('/register-token',
  authenticateToken,
  [
    body('pushToken').isString().notEmpty(),
    body('deviceInfo').optional().isObject(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { pushToken, deviceInfo } = req.body;

      await prisma.userPushToken.upsert({
        where: { userId },
        update: {
          token: pushToken,
          deviceInfo: deviceInfo || {},
          updatedAt: new Date(),
        },
        create: {
          userId,
          token: pushToken,
          deviceInfo: deviceInfo || {},
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Register push token error:', error);
      res.status(500).json({ error: 'Failed to register push token' });
    }
  }
);

// Send test notification
router.post('/test',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      
      // Get user's push token
      const userToken = await prisma.userPushToken.findUnique({
        where: { userId },
      });

      if (!userToken) {
        return res.status(400).json({ error: 'No push token registered' });
      }

      // Send test notification
      const success = await pushNotificationService.sendTestNotification(userId);

      if (success) {
        res.json({ success: true, message: 'Test notification sent!' });
      } else {
        res.status(500).json({ error: 'Failed to send test notification' });
      }
    } catch (error) {
      console.error('Send test notification error:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
);

export default router;