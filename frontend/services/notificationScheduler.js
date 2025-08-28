import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Safely import notification modules
let Notifications;

try {
  Notifications = require('expo-notifications');
} catch (error) {
}

class NotificationScheduler {
  constructor() {
    this.scheduledNotifications = new Map();
  }

  // Schedule daily submission reminders for all groups
  async scheduleDailyReminders() {
    try {
      if (!Notifications) {
        return;
      }

      // Get user's groups
      const response = await api.get('/groups');
      const groups = response.data.groups || [];

      // Get notification settings
      const settingsResponse = await api.get('/notifications/settings');
      const settings = settingsResponse.data.settings || {};

      if (!settings.submissionReminders) {
        return;
      }

      // Cancel existing reminders
      await this.cancelAllReminders();

      // Schedule reminders for each group
      for (const group of groups) {
        await this.scheduleGroupReminders(group, settings);
      }

    } catch (error) {
      console.error('Failed to schedule daily reminders:', error);
    }
  }

  async scheduleGroupReminders(group, settings) {
    const groupName = group.name || `Group ${group.id.slice(0, 8)}`;
    
    // Main reminder (default: 8 PM)
    const reminderTime = settings.submissionReminderTime || '20:00';
    const [hours, minutes] = reminderTime.split(':').map(Number);

    // Calculate next occurrence
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setHours(hours, minutes, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (reminderDate <= now) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }

    // Schedule main reminder
    const mainReminderId = await this.scheduleNotification(
      `🎵 Time to submit your song!`,
      `Submit your daily song to ${groupName}. Deadline is 11 PM!`,
      {
        type: 'submission_reminder',
        groupId: group.id,
        groupName: groupName,
      },
      reminderDate
    );

    if (mainReminderId) {
      this.scheduledNotifications.set(`reminder_${group.id}`, mainReminderId);
    }

    // Last hour reminder (if enabled)
    if (settings.lastHourReminder) {
      const lastHourDate = new Date();
      lastHourDate.setHours(22, 0, 0, 0); // 10 PM

      if (lastHourDate <= now) {
        lastHourDate.setDate(lastHourDate.getDate() + 1);
      }

      const lastHourReminderId = await this.scheduleNotification(
        `🚨 Last chance!`,
        `Only 1 hour left to submit your song to ${groupName}!`,
        {
          type: 'last_hour_reminder',
          groupId: group.id,
          groupName: groupName,
        },
        lastHourDate
      );

      if (lastHourReminderId) {
        this.scheduledNotifications.set(`last_hour_${group.id}`, lastHourReminderId);
      }
    }
  }

  async scheduleNotification(title, body, data, triggerDate) {
    try {
      // Create repeating trigger (daily)
      const trigger = {
        hour: triggerDate.getHours(),
        minute: triggerDate.getMinutes(),
        repeats: true,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
        },
        trigger,
      });

      return id;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  async cancelAllReminders() {
    try {
      // Cancel all scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Clear our tracking
      this.scheduledNotifications.clear();
      
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  async cancelGroupReminders(groupId) {
    try {
      const reminderIds = [
        this.scheduledNotifications.get(`reminder_${groupId}`),
        this.scheduledNotifications.get(`last_hour_${groupId}`)
      ].filter(Boolean);

      for (const id of reminderIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }

      // Remove from tracking
      this.scheduledNotifications.delete(`reminder_${groupId}`);
      this.scheduledNotifications.delete(`last_hour_${groupId}`);

    } catch (error) {
      console.error('Failed to cancel group reminders:', error);
    }
  }

  // Schedule playlist ready notifications
  async schedulePlaylistReadyNotification(groupName, playlistUrl) {
    return this.scheduleNotification(
      `🎵 Your playlist is ready!`,
      `${groupName}'s collaborative playlist is now available to play!`,
      {
        type: 'playlist_ready',
        groupName,
        playlistUrl,
      },
      { seconds: 1 } // Immediate
    );
  }

  // Schedule group activity notifications
  async scheduleGroupActivityNotification(message, groupId, groupName) {
    return this.scheduleNotification(
      `👥 Group Activity`,
      message,
      {
        type: 'group_activity',
        groupId,
        groupName,
      },
      { seconds: 1 } // Immediate
    );
  }

  // Get all scheduled notifications (for debugging)
  async getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  // Save notification preferences to storage
  async saveNotificationPreferences(preferences) {
    try {
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  // Load notification preferences from storage
  async loadNotificationPreferences() {
    try {
      const preferences = await AsyncStorage.getItem('notificationPreferences');
      return preferences ? JSON.parse(preferences) : null;
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      return null;
    }
  }

  // Initialize scheduler with user's groups and settings
  async initialize() {
    try {
      
      // Load and apply current settings
      await this.scheduleDailyReminders();
      
      // Set up periodic refresh (every 24 hours)
      this.setupPeriodicRefresh();
      
    } catch (error) {
      console.error('Failed to initialize notification scheduler:', error);
    }
  }

  setupPeriodicRefresh() {
    // Refresh reminders daily at 3 AM
    const refreshTrigger = {
      hour: 3,
      minute: 0,
      repeats: true,
    };

    Notifications.scheduleNotificationAsync({
      content: {
        title: 'System',
        body: 'Refreshing notifications...',
        data: { type: 'system_refresh' },
      },
      trigger: refreshTrigger,
    }).then(id => {
    }).catch(console.error);
  }
}

export default new NotificationScheduler();