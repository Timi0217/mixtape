import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Safely import notification modules
let Notifications;
let Device;
let Constants;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Constants = require('expo-constants').default;
} catch (error) {
}

// Configure notification behavior (only if available)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  async initialize() {
    try {
      if (!Notifications || !Device || !Constants) {
        return null;
      }

      // Register for push notifications
      const token = await this.registerForPushNotifications();
      if (token) {
        this.expoPushToken = token;
        await this.savePushTokenToServer(token);
      }

      // Set up notification listeners
      this.setupListeners();

      // Initialize notification scheduler
      const { default: notificationScheduler } = await import('./notificationScheduler');
      await notificationScheduler.initialize();

      return token;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return null;
    }
  }

  async registerForPushNotifications() {
    let token;

    if (!Notifications || !Device) {
      return null;
    }

    if (!Device.isDevice) {
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
      } else {
        // Fallback for development
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }

    } catch (e) {
      console.error('Error getting push token:', e);
      return null;
    }

    // Configure notification channels for Android
    if (Device.osName === 'Android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
      });

      await Notifications.setNotificationChannelAsync('daily-reminders', {
        name: 'Daily Reminders',
        description: 'Reminders to submit your daily song',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
      });

      await Notifications.setNotificationChannelAsync('playlist-updates', {
        name: 'Playlist Updates',
        description: 'Updates about your group playlists',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#8B5CF6',
      });
    }

    return token;
  }

  async savePushTokenToServer(token) {
    try {
      await api.post('/notifications/register-token', { 
        pushToken: token,
        deviceInfo: {
          platform: Device.osName,
          deviceName: Device.deviceName,
          osVersion: Device.osVersion,
        }
      });
      
      // Store token locally as backup
      await AsyncStorage.setItem('expoPushToken', token);
    } catch (error) {
      console.error('Failed to save push token to server:', error);
    }
  }

  setupListeners() {
    // Handle notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      // You can customize foreground notification behavior here
    });

    // Handle notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      // Handle different notification types
      this.handleNotificationTap(data);
    });
  }

  handleNotificationTap(data) {
    // Navigate based on notification type
    switch (data?.type) {
      case 'submission_reminder':
        // Navigate to song submission screen
        break;
      case 'playlist_ready':
        // Navigate to playlist screen
        break;
      case 'group_activity':
        // Navigate to specific group
        break;
      default:
        // Default action - maybe open home screen
        break;
    }
  }

  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      if (!Notifications) {
        return null;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger,
      });
      return id;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      return null;
    }
  }

  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  async sendTestNotification() {
    return this.scheduleLocalNotification(
      'Test Notification',
      'This is a test notification from Mixtape! 🎵',
      { type: 'test' },
      { seconds: 1 }
    );
  }

  async scheduleSubmissionReminder(groupName, hours = 2) {
    const trigger = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    return this.scheduleLocalNotification(
      `⏰ Time to submit your song!`,
      `Don't forget to submit your daily song to ${groupName}. Deadline is at 11 PM!`,
      { 
        type: 'submission_reminder',
        groupName 
      },
      trigger
    );
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Get notification permissions status
  async getPermissionsStatus() {
    if (!Notifications) {
      return 'denied';
    }
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    if (!Notifications) {
      return false;
    }
    const status = await this.getPermissionsStatus();
    return status === 'granted';
  }

  // Refresh notification schedules (call when settings change)
  async refreshSchedules() {
    try {
      const { default: notificationScheduler } = await import('./notificationScheduler');
      await notificationScheduler.scheduleDailyReminders();
    } catch (error) {
      console.error('Failed to refresh notification schedules:', error);
    }
  }
}

export default new NotificationService();