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

// Apple Music-style theme matching main app
const theme = {
  colors: {
    // Main Colors - Enhanced depth
    bgPrimary: '#e0d4ff',      // Light purple background leading to purple theme
    surfaceWhite: '#ffffff',   // Pure white cards
    surfaceTinted: '#f1f3f4',  // Light gray tint
    surfaceElevated: '#ffffff', // Elevated white surface
    
    // Text - Apple-style hierarchy
    textPrimary: '#000000',    // True black for maximum contrast
    textSecondary: '#3c3c43',  // iOS secondary text
    textTertiary: '#8e8e93',   // iOS tertiary text
    
    // Buttons & Actions - Purple and green theme
    primaryButton: '#8B5CF6',  // Purple - primary actions
    secondaryButton: '#F2F2F7', // iOS secondary background  
    accent: '#10B981',         // Emerald green - accent color
    
    // States & Status
    success: '#34C759',        // iOS green - success states
    active: '#8B5CF6',         // Purple - active tabs
    groupHeader: '#1d1d1f',    // Apple-style dark text
    pending: '#D1D5DB',        // Light gray - pending states
    error: '#FF3B30',          // iOS red - error states
    warning: '#FF9500',        // iOS orange - warning states
    
    // Borders
    borderLight: '#C6C6C8',    // iOS separator light
    borderMedium: '#8E8E93',   // iOS separator medium
    
    // Shadow - Apple-style depth
    shadow: 'rgba(0, 0, 0, 0.04)', // Subtle shadow
    shadowMedium: 'rgba(0, 0, 0, 0.08)', // Medium shadow
    shadowStrong: 'rgba(0, 0, 0, 0.16)', // Strong shadow
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 20,
    xl: 24,
  },
};

const PhoneLoginScreen = ({ onLoginSuccess, onBack }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'verify'
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const phoneInputRef = useRef(null);
  const codeInputRef = useRef(null);

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
        const { token, user } = response.data;
        setAuthToken(token);
        onLoginSuccess(token, user);
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
            {step === 'phone' ? (
              <>
                {/* Phone Number Step */}
                <View style={styles.heroSection}>
                  <Text style={styles.emoji}>📱</Text>
                  <Text style={styles.title}>Enter Your Phone Number</Text>
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
            ) : (
              <>
                {/* Verification Step */}
                <View style={styles.heroSection}>
                  <Text style={styles.emoji}>🔐</Text>
                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    We sent a 6-digit code to{'\n'}{phoneNumber}
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
                      placeholder="123456"
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
                      <Text style={styles.primaryButtonText}>Verify & Login</Text>
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
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.primaryButton,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl * 2,
  },
  emoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Input Section
  inputSection: {
    gap: theme.spacing.lg,
  },
  inputContainer: {
    gap: theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    padding: 18,
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    // Shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: '700',
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: theme.colors.primaryButton,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    // Shadow
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondaryButton,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  
  // Resend Section
  resendSection: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textTertiary,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primaryButton,
  },
});

export default PhoneLoginScreen;