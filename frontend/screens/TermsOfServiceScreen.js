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

export default function TermsOfServiceScreen({ onClose }) {
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
        <Text style={styles.title}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.lastUpdated}>
          <Text style={styles.lastUpdatedText}>Last Updated: December 2024</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.introText}>
            Welcome to Mixtape! These Terms of Service govern your use of our app. 
            By using Mixtape, you agree to these terms. Please read them carefully.
          </Text>
        </View>

        {renderSection(
          "About Mixtape",
          `Mixtape is a music sharing app that allows you to create collaborative playlists with friends. 
          
Every day, group members submit one song by 11 PM. If everyone participates, you receive a playlist at 8 AM the next day. If anyone misses the deadline, no playlist is created for the group.

Our service connects to your Spotify or Apple Music account to create and manage playlists on your behalf.`
        )}

        {renderSection(
          "Account Registration",
          `To use Mixtape, you must:

• Be at least 13 years old
• Provide accurate account information
• Have a valid Spotify or Apple Music account
• Maintain the security of your account credentials
• Not share your account with others

You are responsible for all activity that occurs under your account.`
        )}

        {renderSection(
          "Acceptable Use",
          `When using Mixtape, you agree to:

• Submit only appropriate, legal content
• Respect other users and their music preferences
• Not spam, harass, or abuse other users
• Not attempt to access others' private information
• Not use the app for any illegal or harmful activities
• Follow all applicable laws and regulations

We reserve the right to remove content or suspend accounts that violate these guidelines.`
        )}

        {renderSection(
          "Music Platform Integration",
          `Mixtape integrates with third-party music platforms (Spotify, Apple Music). By using our app:

• You authorize us to access your music platform account
• You agree to the terms of service of your music platform
• We may create, modify, and manage playlists on your behalf
• You can revoke our access at any time through platform settings

We are not responsible for changes to third-party platform policies or availability.`
        )}

        {renderSection(
          "Content and Intellectual Property",
          `User Content: You retain ownership of content you submit but grant us a license to use, display, and share it within the app's functionality.

Music Content: All music content belongs to the respective artists, labels, and platforms. We do not claim ownership of any musical works.

App Content: The Mixtape app, including design, features, and functionality, is owned by us and protected by copyright and other intellectual property laws.`
        )}

        {renderSection(
          "Privacy and Data",
          `We collect and use your information as described in our Privacy Policy. By using Mixtape, you agree to our data collection and use practices.

Your privacy is important to us, and we implement reasonable security measures to protect your information.`
        )}

        {renderSection(
          "Service Availability",
          `We strive to keep Mixtape available 24/7, but we cannot guarantee uninterrupted service. We may:

• Temporarily suspend service for maintenance
• Update or modify app features
• Experience downtime due to technical issues
• Discontinue the service with reasonable notice

We are not liable for any disruptions to the service.`
        )}

        {renderSection(
          "Limitation of Liability",
          `Mixtape is provided "as is" without warranties of any kind. To the fullest extent permitted by law:

• We are not liable for any indirect, incidental, or consequential damages
• Our total liability is limited to the amount you paid for the service
• We do not warrant that the service will be error-free or uninterrupted
• You use the service at your own risk`
        )}

        {renderSection(
          "Account Termination",
          `You may delete your account at any time through the app settings.

We may suspend or terminate your account if you:
• Violate these terms
• Engage in harmful or illegal activities
• Abuse other users or the service
• Remain inactive for an extended period

Upon termination, your access to the service will end, and your data may be deleted.`
        )}

        {renderSection(
          "Changes to Terms",
          `We may update these Terms of Service from time to time. We will notify you of material changes through the app or by email. 

Your continued use of Mixtape after changes constitutes acceptance of the updated terms. If you don't agree to the changes, you should stop using the service.`
        )}

        {renderSection(
          "Governing Law",
          `These terms are governed by the laws of the United States. Any disputes will be resolved through binding arbitration, except where prohibited by law.

If any provision of these terms is found to be unenforceable, the remaining provisions will continue in effect.`
        )}

        <View style={styles.contact}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionContent}>
            If you have questions about these Terms of Service, please contact us:
            {'\n\n'}
            Email: legal@mixtape-app.com
            {'\n\n'}
            We're here to help clarify any questions about your use of Mixtape.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Mixtape. All rights reserved.
            {'\n\n'}
            Thank you for using Mixtape and happy music sharing! 🎵
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
    textAlign: 'center',
    lineHeight: 20,
  },
});