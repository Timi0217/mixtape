import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';

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

export default function AboutScreen({ onClose }) {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const handleLinkPress = (url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link. Please try again later.');
    });
  };

  const handleFeedback = () => {
    Alert.alert(
      'Send Feedback',
      'Choose how you\'d like to send feedback:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Email', 
          onPress: () => handleLinkPress('mailto:feedback@mixtape-app.com?subject=Mixtape Feedback')
        },
        { 
          text: 'Twitter', 
          onPress: () => handleLinkPress('https://twitter.com/mixtape_app')
        },
      ]
    );
  };

  const renderSection = (title, items) => (
    <View style={styles.section} key={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.listItem}
          onPress={item.onPress}
        >
          <View style={styles.listItemContent}>
            <Text style={styles.listItemIcon}>{item.icon}</Text>
            <View style={styles.listItemText}>
              <Text style={styles.listItemTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.listItemDescription}>{item.description}</Text>
              )}
            </View>
          </View>
          <Text style={styles.listItemArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const supportItems = [
    {
      icon: '💬',
      title: 'Send Feedback',
      description: 'Share your thoughts and suggestions',
      onPress: handleFeedback,
    },
    {
      icon: '🐛',
      title: 'Report a Bug',
      description: 'Let us know about any issues you encounter',
      onPress: () => handleLinkPress('mailto:bugs@mixtape-app.com?subject=Bug Report'),
    },
    {
      icon: '❓',
      title: 'Help & FAQ',
      description: 'Find answers to common questions',
      onPress: () => Alert.alert('Coming Soon', 'Help documentation will be available in a future update.'),
    },
    {
      icon: '📧',
      title: 'Contact Support',
      description: 'Get help from our support team',
      onPress: () => handleLinkPress('mailto:support@mixtape-app.com'),
    },
  ];

  const legalItems = [
    {
      icon: '📄',
      title: 'Terms of Service',
      description: 'Read our terms and conditions',
      onPress: () => setShowTermsOfService(true),
    },
    {
      icon: '🔒',
      title: 'Privacy Policy',
      description: 'Learn how we protect your data',
      onPress: () => setShowPrivacyPolicy(true),
    },
    {
      icon: '⚖️',
      title: 'Licenses',
      description: 'Third-party software licenses',
      onPress: () => Alert.alert('Coming Soon', 'License information will be available soon.'),
    },
  ];

  const socialItems = [
    {
      icon: '🐦',
      title: 'Twitter',
      description: 'Follow us for updates @mixtape_app',
      onPress: () => handleLinkPress('https://twitter.com/mixtape_app'),
    },
    {
      icon: '📱',
      title: 'Instagram',
      description: 'See what\'s happening @mixtape_app',
      onPress: () => handleLinkPress('https://instagram.com/mixtape_app'),
    },
    {
      icon: '🌐',
      title: 'Website',
      description: 'Visit our website for more info',
      onPress: () => handleLinkPress('https://mixtape-app.com'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>About Mixtape</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Info Section */}
        <View style={styles.appInfoSection}>
          <View style={styles.appIcon}>
            <Text style={styles.appIconText}>🎵</Text>
          </View>
          <Text style={styles.appName}>Mixtape</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDescription}>
            Share your daily music discoveries with friends. Every day, everyone submits one song by 11 PM. 
            If everyone participates, you get a collaborative playlist at 8 AM. Miss the deadline? No playlist for anyone.
          </Text>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Mixtape Works</Text>
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Create or join a group with friends</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Everyone submits one song daily by 11 PM</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>If everyone participates, get your playlist at 8 AM</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Miss the deadline? No playlist for the group</Text>
            </View>
          </View>
        </View>

        {renderSection('Support', supportItems)}
        {renderSection('Legal', legalItems)}
        {renderSection('Follow Us', socialItems)}

        {/* Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credits</Text>
          <Text style={styles.creditsText}>
            Built with ❤️ by the Mixtape team{'\n\n'}
            Special thanks to all the music platforms that make this possible:{'\n'}
            • Spotify{'\n'}
            • Apple Music{'\n\n'}
            And to our beta testers who helped make Mixtape awesome! 🙏
          </Text>
        </View>

        {/* Build Info */}
        <View style={styles.buildInfo}>
          <Text style={styles.buildInfoText}>
            Build: 1.0.0 (2024){'\n'}
            Made with React Native & Expo{'\n'}
            © 2024 Mixtape. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showPrivacyPolicy}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <PrivacyPolicyScreen onClose={() => setShowPrivacyPolicy(false)} />
      </Modal>

      <Modal
        visible={showTermsOfService}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TermsOfServiceScreen onClose={() => setShowTermsOfService(false)} />
      </Modal>
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
  appInfoSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  appIconText: {
    fontSize: 36,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  appVersion: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  appDescription: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  stepsList: {
    gap: theme.spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  listItem: {
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
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemIcon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
    width: 32,
    textAlign: 'center',
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  listItemDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  listItemArrow: {
    fontSize: 24,
    color: theme.colors.textTertiary,
  },
  creditsText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  buildInfo: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  buildInfoText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});