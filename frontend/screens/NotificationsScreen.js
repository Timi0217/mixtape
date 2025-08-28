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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';
import notificationService from '../services/notificationService';

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
  const [showQuietHours, setShowQuietHours] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(null); // 'start' or 'end'
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
    allSubmitted: true,
    mixtapeReady: true,
    playlistFailed: true,
    
    // Social features
    friendRequests: true,
    mentions: true,
    
    // System notifications
    appUpdates: true,
    maintenance: true,
    
    // Quiet hours
    quietHoursEnabled: false,
    quietHoursStart: '22:00', // 10 PM
    quietHoursEnd: '08:00', // 8 AM
    
    // Delivery methods
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
  });

  useEffect(() => {
    loadNotificationSettings();
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    try {
      await notificationService.initialize();
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/settings');
      if (response.data.settings) {
        setSettings({ ...settings, ...response.data.settings });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      Alert.alert('Error', 'Failed to load settings. Using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      await api.put('/notifications/settings', { [key]: value });

      // Refresh notification schedules if reminder settings changed
      if (key === 'submissionReminders' || key === 'lastHourReminder' || key === 'submissionReminderTime') {
        await notificationService.refreshSchedules();
      }
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      Alert.alert('Error', 'Failed to save notification setting.');
      // Revert the change
      setSettings(settings);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(null);
    
    if (selectedTime && showTimePicker) {
      const timeString = selectedTime.toTimeString().slice(0, 5);
      const key = showTimePicker === 'start' ? 'quietHoursStart' : 'quietHoursEnd';
      updateSetting(key, timeString);
    }
  };

  const getTimeAsDate = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  };

  const renderToggleItem = (key, title, description, iconName = 'notifications-outline') => (
    <View style={styles.settingItem} key={key}>
      <View style={styles.settingIcon}>
        <Ionicons name={iconName} size={20} color={theme.colors.primaryButton} />
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
      null,
      [
        ['submissionReminders', 'Submission reminders', 'Daily song submission reminder', 'time-outline'],
        ['lastHourReminder', 'Last hour reminder', 'Final reminder before deadline', 'warning-outline'],
      ]
    ],
    [
      'Group Activity',
      null,
      [
        ['groupActivity', 'Group activity', 'General group updates', 'people-outline'],
        ['newMemberJoined', 'New members', 'When someone joins', 'person-add-outline'],
        ['memberLeftGroup', 'Member departures', 'When someone leaves', 'person-remove-outline'],
      ]
    ],
    [
      'Mixtapes',
      null,
      [
        ['allSubmitted', 'All submitted', 'When everyone has submitted', 'people-circle-outline'],
        ['mixtapeReady', 'Mixtape ready', 'When your mixtape is available', 'musical-notes-outline'],
        ['playlistFailed', 'Mixtape failed', 'When mixtape creation fails', 'close-circle-outline'],
      ]
    ],
    [
      'Social',
      null,
      [
        ['friendRequests', 'Friend requests', 'When someone wants to connect', 'person-circle-outline'],
        ['mentions', 'Mentions', 'When someone mentions you', 'at-outline'],
      ]
    ],
    [
      'System',
      null,
      [
        ['appUpdates', 'App updates', 'New features and improvements', 'download-outline'],
        ['maintenance', 'Maintenance', 'Scheduled maintenance notices', 'build-outline'],
      ]
    ],
    [
      'Delivery Methods',
      null,
      [
        ['pushNotifications', 'Push notifications', 'Notifications on your device', 'phone-portrait-outline'],
        ['emailNotifications', 'Email notifications', 'Notifications via email', 'mail-outline'],
        ['smsNotifications', 'SMS notifications', 'Notifications via text message', 'chatbubble-outline'],
      ]
    ]
  ];

  const renderQuietHours = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quiet Hours</Text>
      
      <TouchableOpacity 
        style={styles.timeButton}
        onPress={() => setShowQuietHours(true)}
      >
        <View style={styles.timeButtonInfo}>
          <Text style={styles.timeButtonTitle}>Quiet hours</Text>
          <Text style={styles.timeButtonTime}>
            {settings.quietHoursStart?.slice(0, 5) || '22:00'} - {settings.quietHoursEnd?.slice(0, 5) || '08:00'}
          </Text>
        </View>
        <Text style={styles.timeButtonArrow}>›</Text>
      </TouchableOpacity>
      
      <View style={styles.settingItem}>
        <View style={styles.settingIcon}>
          <Ionicons name="moon-outline" size={20} color={theme.colors.primaryButton} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Respect quiet hours</Text>
          <Text style={styles.settingDescription}>Silence notifications during quiet hours</Text>
        </View>
        <Switch
          value={settings.quietHoursEnabled}
          onValueChange={(value) => updateSetting('quietHoursEnabled', value)}
          trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
        />
      </View>
    </View>
  );

  const renderTestNotification = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Test Notifications</Text>
      
      <TouchableOpacity 
        style={styles.testButton}
        onPress={async () => {
          try {
            const permissionStatus = await notificationService.getPermissionsStatus();
            if (permissionStatus !== 'granted') {
              Alert.alert(
                'Notifications Disabled', 
                'Enable notifications in device settings first.',
                [{ text: 'OK' }]
              );
              return;
            }

            await notificationService.sendTestNotification();
            Alert.alert('Test Notification Sent!', 'Check your notification panel to see if it arrived.');
          } catch (error) {
            console.error('Failed to send test notification:', error);
            Alert.alert('Error', 'Failed to send test notification.');
          }
        }}
      >
        <Text style={styles.testButtonText}>Send Test Notification</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuietHoursModal = () => (
    <Modal
      visible={showQuietHours}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowQuietHours(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Quiet Hours</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Set Your Quiet Hours</Text>
          
          <View style={styles.timePickerSection}>
            <View style={styles.timePicker}>
              <Text style={styles.timeLabel}>Start Time</Text>
              <TouchableOpacity 
                style={styles.timeValue}
                onPress={() => setShowTimePicker('start')}
              >
                <Text style={styles.timeValueText}>{settings.quietHoursStart?.slice(0, 5) || '22:00'}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.timePicker}>
              <Text style={styles.timeLabel}>End Time</Text>
              <TouchableOpacity 
                style={styles.timeValue}
                onPress={() => setShowTimePicker('end')}
              >
                <Text style={styles.timeValueText}>{settings.quietHoursEnd?.slice(0, 5) || '08:00'}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.quietHoursDescription}>
            During quiet hours, you won't receive notifications. Emergency notifications may still come through.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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

      {renderQuietHoursModal()}
      
      {showTimePicker && (
        <DateTimePicker
          value={getTimeAsDate(showTimePicker === 'start' ? settings.quietHoursStart || '22:00' : settings.quietHoursEnd || '08:00')}
          mode="time"
          display="spinner"
          onChange={handleTimeChange}
        />
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
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
  timePickerSection: {
    marginBottom: theme.spacing.xl,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValueText: {
    fontSize: 16,
    color: theme.colors.primaryButton,
    marginRight: theme.spacing.sm,
    fontWeight: '600',
  },
  quietHoursDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
});