import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const theme = {
  colors: {
    bgPrimary: '#f8f9fa',
    surfaceWhite: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    primaryButton: '#8B5CF6',
    borderLight: '#E5E7EB',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    lg: 20,
  },
};

export default function PrivacyPolicyScreen({ onClose }) {
  const renderSection = (title, content) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.lastUpdated}>
          <Text style={styles.lastUpdatedText}>Last Updated: December 2024</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.introText}>
            At Mixtape, we respect your privacy and are committed to protecting your personal information. 
            This Privacy Policy explains how we collect, use, and safeguard your data when you use our app.
          </Text>
        </View>

        {renderSection(
          "Information We Collect",
          `Account Information: When you create an account, we collect your email address, display name, and music platform credentials (Spotify or Apple Music).

Phone Number: For verification purposes, we may collect your phone number.

Usage Data: We collect information about how you use the app, including songs you submit, groups you join, and playlists you create.

Device Information: We may collect basic device information such as device type, operating system, and app version for analytics and troubleshooting.`
        )}

        {renderSection(
          "How We Use Your Information",
          `Service Delivery: To provide core app functionality including group management, playlist creation, and music sharing.

Communication: To send important updates about your account, groups, and daily playlist notifications.

Improvement: To analyze app usage and improve our services, fix bugs, and develop new features.

Security: To protect against fraud, abuse, and unauthorized access to your account.`
        )}

        {renderSection(
          "Information Sharing",
          `Group Members: Your display name and submitted songs are visible to members of groups you join.

Music Platforms: We connect to your Spotify or Apple Music account to create playlists. We only access information necessary for playlist creation.

Service Providers: We may share data with trusted service providers who help us operate the app (hosting, analytics, customer support).

We do not sell your personal information to third parties.`
        )}

        {renderSection(
          "Data Security",
          `We implement industry-standard security measures to protect your personal information:

• Secure data transmission using encryption
• Secure cloud storage with access controls
• Regular security audits and updates
• Limited employee access on a need-to-know basis

While we strive to protect your data, no method of transmission over the internet is 100% secure.`
        )}

        {renderSection(
          "Your Rights and Choices",
          `Account Control: You can update your account information and privacy settings within the app.

Data Access: You can request access to the personal data we have about you.

Data Deletion: You can delete your account and associated data at any time through the app settings.

Communication Preferences: You can opt out of non-essential communications.

Music Platform Access: You can revoke our access to your music platforms through their respective settings.`
        )}

        {renderSection(
          "Children's Privacy",
          `Mixtape is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.`
        )}

        {renderSection(
          "International Users",
          `If you use Mixtape from outside the United States, your information may be transferred to and processed in the United States where our servers are located. By using our service, you consent to this transfer.`
        )}

        {renderSection(
          "Changes to This Policy",
          `We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last Updated" date. Your continued use of the app after changes constitutes acceptance of the updated policy.`
        )}

        <View style={styles.contact}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionContent}>
            If you have any questions about this Privacy Policy or our data practices, please contact us:
            {'\n\n'}
            Email: privacy@mixtape-app.com
            {'\n\n'}
            We're committed to addressing your privacy concerns promptly and transparently.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Mixtape. All rights reserved.
          </Text>
        </View>
      </ScrollView>
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
  lastUpdated: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  lastUpdatedText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  intro: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  introText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  sectionContent: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  contact: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
});