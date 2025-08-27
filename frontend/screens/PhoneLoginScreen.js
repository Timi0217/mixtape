import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { setAuthToken } from '../services/api';
import api from '../services/api';

// Mixtape theme with Apple design principles
const theme = {
  colors: {
    // Mixtape brand colors with Apple aesthetics
    bgPrimary: '#e0d4ff',      // Mixtape purple background
    bgSecondary: '#ffffff',    // Pure white for cards/surfaces
    
    // Apple's text hierarchy with Mixtape context
    textPrimary: '#1C1C1E',    // iOS label - highest contrast
    textSecondary: '#3A3A3C',  // iOS secondary label
    textTertiary: '#48484A',   // iOS tertiary label
    textQuaternary: '#8E8E93', // iOS quaternary label
    
    // Mixtape button system
    primaryButton: '#8B5CF6',  // Mixtape purple - primary actions
    secondaryButton: '#F2F2F7', // iOS secondary background
    accent: '#10B981',         // Mixtape emerald green
    
    // Apple's semantic colors
    systemRed: '#FF3B30',      // Destructive actions
    systemGreen: '#34C759',    // Success states
    systemOrange: '#FF9500',   // Warning states
    
    // Apple's separators
    separator: 'rgba(60, 60, 67, 0.29)',      // Opaque separator
    separatorNonOpaque: 'rgba(60, 60, 67, 0.36)', // Non-opaque separator
    
    // Apple's fills with purple tint
    fill: 'rgba(139, 92, 246, 0.1)',          // Purple-tinted fill
    secondaryFill: 'rgba(139, 92, 246, 0.06)', // Light purple fill
    tertiaryFill: 'rgba(139, 92, 246, 0.03)',  // Very light purple fill
  },
  spacing: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    xxxl: 24,
    xxxxl: 32,
  },
  borderRadius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    xxl: 16,
    xxxl: 20,
  },
  typography: {
    // Apple's San Francisco font weights
    ultraLight: '100',
    thin: '200', 
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
    black: '900',
  }
};

const PhoneLoginScreen = ({ onLoginSuccess, onBack }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [username, setUsername] = useState('');
  const [step, setStep] = useState('phone'); // 'phone', 'verify', or 'username'
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const phoneInputRef = useRef(null);
  const codeInputRef = useRef(null);
  const usernameInputRef = useRef(null);

  const formatPhoneNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (cleaned.length >= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return cleaned;
    }
  };

  const handlePhoneSubmit = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);

    try {
      // Send verification code
      const response = await api.post('/auth/phone/send-code', {
        phoneNumber: `+1${cleanPhone}` // Adding US country code
      });

      if (response.data.success) {
        setStep('verify');
        startCountdown();
        setTimeout(() => codeInputRef.current?.focus(), 100);
      } else {
        throw new Error(response.data.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      Alert.alert(
        'Verification Failed',
        error.response?.data?.error || 'Failed to send verification code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const response = await api.post('/auth/phone/verify-code', {
        phoneNumber: `+1${cleanPhone}`,
        code: verificationCode
      });

      if (response.data.success) {
        if (response.data.isExistingUser && response.data.token) {
          // Existing user with proper username - log them in directly
          const { token, user } = response.data;
          setAuthToken(token);
          onLoginSuccess(token, user);
        } else if (response.data.requiresUsername) {
          // New user or user needs username - proceed to username step
          setStep('username');
          setTimeout(() => usernameInputRef.current?.focus(), 100);
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error(response.data.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Code verification error:', error);
      Alert.alert(
        'Verification Failed',
        error.response?.data?.error || 'Invalid verification code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = async () => {
    if (username.trim().length < 2) {
      Alert.alert('Invalid Username', 'Username must be at least 2 characters long.');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const response = await api.post('/auth/phone/complete-signup', {
        phoneNumber: `+1${cleanPhone}`,
        code: verificationCode,
        username: username.trim()
      });

      if (response.data.success) {
        const { token, user } = response.data;
        setAuthToken(token);
        onLoginSuccess(token, user);
      } else {
        throw new Error(response.data.error || 'Account creation failed');
      }
    } catch (error) {
      console.error('Username signup error:', error);
      Alert.alert(
        'Signup Failed',
        error.response?.data?.error || 'Failed to create account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendCode = () => {
    handlePhoneSubmit();
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setVerificationCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 'phone' && (
              <>
                {/* Phone Number Step */}
                <View style={styles.heroSection}>
                  <Text style={styles.title}>Phone Number</Text>
                  <Text style={styles.subtitle}>
                    We'll send you a verification code to confirm your number
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      ref={phoneInputRef}
                      style={styles.textInput}
                      value={phoneNumber}
                      onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="phone-pad"
                      maxLength={14}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, (!phoneNumber || loading) && styles.buttonDisabled]}
                    onPress={handlePhoneSubmit}
                    disabled={!phoneNumber || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'verify' && (
              <>
                {/* Verification Step */}
                <View style={styles.heroSection}>
                  <Text style={styles.title}>Verification Code</Text>
                  <Text style={styles.subtitle}>
                    We sent a 6-digit code to {phoneNumber}
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Verification Code</Text>
                    <TextInput
                      ref={codeInputRef}
                      style={[styles.textInput, styles.codeInput]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder=""
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, (verificationCode.length !== 6 || loading) && styles.buttonDisabled]}
                    onPress={handleCodeSubmit}
                    disabled={verificationCode.length !== 6 || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>

                  {/* Resend Code */}
                  <View style={styles.resendSection}>
                    {countdown > 0 ? (
                      <Text style={styles.countdownText}>
                        Resend code in {countdown}s
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleResendCode}>
                        <Text style={styles.resendText}>Resend Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Back to Phone */}
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToPhone}>
                    <Text style={styles.secondaryButtonText}>Change Phone Number</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'username' && (
              <>
                {/* Username Step */}
                <View style={styles.heroSection}>
                  <Text style={styles.title}>Choose Username</Text>
                  <Text style={styles.subtitle}>
                    Pick a username so your friends can find you
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput
                      ref={usernameInputRef}
                      style={styles.textInput}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="johnsmith"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="default"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={30}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, (username.trim().length < 2 || loading) && styles.buttonDisabled]}
                    onPress={handleUsernameSubmit}
                    disabled={username.trim().length < 2 || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                    )}
                  </TouchableOpacity>

                  {/* Back to Verification */}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('verify')}>
                    <Text style={styles.secondaryButtonText}>Back to Verification</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  
  // Header - Apple's minimal navigation style
  header: {
    paddingHorizontal: theme.spacing.xxxxl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: theme.typography.regular,
    color: theme.colors.systemBlue,
    letterSpacing: -0.24, // Apple's SF Pro letter spacing
  },
  
  // Content - Apple's generous white space
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xxxxl,
    justifyContent: 'flex-start',
  },
  
  // Hero Section - Apple's large title style
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxxl * 2,
    paddingTop: theme.spacing.xxxl,
  },
  title: {
    fontSize: 34, // Apple's Large Title size
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    letterSpacing: -0.41, // Apple's Large Title letter spacing
    lineHeight: 41, // Apple's Large Title line height
  },
  subtitle: {
    fontSize: 17, // Apple's Body text size
    fontWeight: theme.typography.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22, // Apple's Body line height
    letterSpacing: -0.24,
    paddingHorizontal: theme.spacing.lg,
  },
  
  // Input Section - Apple's form styling
  inputSection: {
    gap: theme.spacing.xxxl,
  },
  inputContainer: {
    gap: theme.spacing.md,
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.24,
    marginBottom: theme.spacing.sm,
  },
  textInput: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    fontSize: 17,
    fontWeight: theme.typography.regular,
    color: theme.colors.textPrimary,
    borderWidth: 0.5, // Apple's hairline border
    borderColor: theme.colors.separator,
    letterSpacing: -0.24,
    // Apple's subtle shadow
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: theme.spacing.lg, // Generous spacing for code
    fontSize: 28, // Larger for better readability
    fontWeight: theme.typography.medium,
    fontVariant: ['tabular-nums'], // Monospace numbers
  },
  
  // Buttons - Mixtape purple with Apple style
  primaryButton: {
    backgroundColor: theme.colors.primaryButton,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50, // Apple's recommended touch target
    // Mixtape purple button shadow
    shadowColor: 'rgba(139, 92, 246, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: theme.typography.semibold,
    color: '#FFFFFF',
    letterSpacing: -0.24,
  },
  buttonDisabled: {
    opacity: 0.6, // Apple's disabled state
    shadowOpacity: 0,
  },
  secondaryButton: {
    backgroundColor: theme.colors.systemGray6,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 0.5,
    borderColor: theme.colors.separator,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: theme.typography.medium,
    color: theme.colors.primaryButton,
    letterSpacing: -0.24,
  },
  
  // Resend Section - Apple's secondary text style
  resendSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  countdownText: {
    fontSize: 15, // Apple's Footnote size
    fontWeight: theme.typography.regular,
    color: theme.colors.textTertiary,
    letterSpacing: -0.23,
  },
  resendText: {
    fontSize: 15,
    fontWeight: theme.typography.medium,
    color: theme.colors.primaryButton,
    letterSpacing: -0.23,
  },
});

export default PhoneLoginScreen;