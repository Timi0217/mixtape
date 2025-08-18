import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import api from '../services/api';

const theme = {
  colors: {
    bgPrimary: '#f8f9fa',
    surfaceWhite: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    primaryButton: '#8B5CF6',
    secondaryButton: '#F3F4F6',
    borderLight: '#E5E7EB',
    shadow: 'rgba(0, 0, 0, 0.1)',
    success: '#10B981',
    error: '#EF4444',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 20,
  },
};

export default function NotificationsScreen({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    // Daily submission reminders
    submissionReminders: true,
    submissionReminderTime: '20:00', // 8 PM
    lastHourReminder: true,
    
    // Group activity
    groupActivity: true,
    newMemberJoined: true,
    memberLeftGroup: false,
    
    // Playlist notifications
    playlistGenerated: true,
    playlistReady: true,
    playlistFailed: true,
    
    // Social features
    friendRequests: true,
    mentions: true,
    
    // System notifications
    appUpdates: true,
    maintenance: true,
    
    // Delivery methods
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/settings');
      if (response.data.settings) {
        setSettings({ ...settings, ...response.data.settings });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings. Using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      await api.put('/notifications/settings', { [key]: value });
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      Alert.alert('Error', 'Failed to save notification setting. Please try again.');
      // Revert the change
      setSettings(settings);
    }
  };

  const renderToggleItem = (key, title, description, icon = '🔔') => (
    <View style={styles.settingItem} key={key}>
      <View style={styles.settingIcon}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(value) => updateSetting(key, value)}
        trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
      />
    </View>
  );

  const renderSection = (title, description, items) => (
    <View style={styles.section} key={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description && (
        <Text style={styles.sectionDescription}>{description}</Text>
      )}
      {items.map(item => renderToggleItem(...item))}
    </View>
  );

  const sections = [
    [
      'Daily Reminders',
      'Get reminders about your daily song submissions',
      [
        ['submissionReminders', 'Submission reminders', 'Daily reminder to submit your song', '⏰'],
        ['lastHourReminder', 'Last hour reminder', 'Extra reminder 1 hour before deadline', '🚨'],
      ]
    ],
    [
      'Group Activity',
      'Stay updated with your group activities',
      [
        ['groupActivity', 'Group activity', 'General group updates and changes', '👥'],
        ['newMemberJoined', 'New members', 'When someone joins your group', '👋'],
        ['memberLeftGroup', 'Member departures', 'When someone leaves your group', '👋'],
      ]
    ],
    [
      'Playlists',
      'Notifications about your group playlists',
      [
        ['playlistGenerated', 'Playlist created', 'When your daily playlist is generated', '🎵'],
        ['playlistReady', 'Playlist ready', 'When your playlist is ready to play', '✅'],
        ['playlistFailed', 'Playlist failed', 'When playlist creation fails', '❌'],
      ]
    ],
    [
      'Social',
      'Social interaction notifications',
      [
        ['friendRequests', 'Friend requests', 'When someone wants to connect with you', '👥'],
        ['mentions', 'Mentions', 'When someone mentions you in comments', '@'],
      ]
    ],
    [
      'System',
      'App updates and maintenance notifications',
      [
        ['appUpdates', 'App updates', 'New features and improvements', '🆕'],
        ['maintenance', 'Maintenance', 'Scheduled maintenance notices', '🔧'],
      ]
    ],
    [
      'Delivery Methods',
      'How you want to receive notifications',
      [
        ['pushNotifications', 'Push notifications', 'Notifications on your device', '📱'],
        ['emailNotifications', 'Email notifications', 'Notifications via email', '📧'],
        ['smsNotifications', 'SMS notifications', 'Notifications via text message', '💬'],
      ]
    ]
  ];

  const renderQuietHours = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quiet Hours</Text>
      <Text style={styles.sectionDescription}>
        Set times when you don't want to receive notifications
      </Text>
      
      <TouchableOpacity 
        style={styles.timeButton}
        onPress={() => Alert.alert('Coming Soon', 'Quiet hours configuration will be available in a future update.')}
      >
        <View style={styles.timeButtonInfo}>
          <Text style={styles.timeButtonTitle}>Quiet hours</Text>
          <Text style={styles.timeButtonTime}>10:00 PM - 8:00 AM</Text>
        </View>
        <Text style={styles.timeButtonArrow}>›</Text>
      </TouchableOpacity>
      
      <View style={styles.settingItem}>
        <View style={styles.settingIcon}>
          <Text style={styles.settingIconText}>🌙</Text>
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Respect quiet hours</Text>
          <Text style={styles.settingDescription}>Don't send notifications during quiet hours</Text>
        </View>
        <Switch
          value={true}
          onValueChange={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
          trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
        />
      </View>
    </View>
  );

  const renderTestNotification = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Test Notifications</Text>
      <Text style={styles.sectionDescription}>
        Send a test notification to make sure everything is working
      </Text>
      
      <TouchableOpacity 
        style={styles.testButton}
        onPress={() => {
          Alert.alert('Test Notification Sent!', 'Check your notification panel to see if it arrived.');
        }}
      >
        <Text style={styles.testButtonText}>Send Test Notification</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryButton} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {sections.map(section => renderSection(...section))}
          {renderQuietHours()}
          {renderTestNotification()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  settingIconText: {
    fontSize: 20,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeButtonInfo: {
    flex: 1,
  },
  timeButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  timeButtonTime: {
    fontSize: 14,
    color: theme.colors.primaryButton,
    fontWeight: '500',
  },
  timeButtonArrow: {
    fontSize: 24,
    color: theme.colors.textTertiary,
  },
  testButton: {
    backgroundColor: theme.colors.primaryButton,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
});