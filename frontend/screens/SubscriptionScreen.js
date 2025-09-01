import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Animated, Dimensions, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSubscription } from '../context/SubscriptionContext';
import api from '../services/api';

const { width, height } = Dimensions.get('window');

const theme = {
  colors: {
    bgPrimary: '#f2f2f7',
    surfaceWhite: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#3c3c43',
    textTertiary: '#8e8e93',
    primaryButton: '#8B5CF6',
    accent: '#10B981',
    borderLight: '#C6C6C8',
    shadow: 'rgba(0, 0, 0, 0.04)',
    shadowMedium: 'rgba(0, 0, 0, 0.08)',
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

const SubscriptionScreen = ({ onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const { refreshSubscription } = useSubscription();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'Mixtape Basic',
      price: 'Free',
      period: '',
      features: [
        'Share 1 song in 1 group per day',
        'Custom group themes',
        'Basic analytics'
      ],
      color: '#8e8e93',
      gradient: ['#f8f9fa', '#e9ecef'],
    },
    {
      id: 'pro',
      name: 'Mixtape Pro',
      price: '$4.99',
      period: '/month',
      features: [
        'Unlimited song sharing',
        'Join unlimited groups',
        'Custom group themes',
        'Advanced analytics',
        'Early access to features'
      ],
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#7C3AED'],
      popular: true,
    },
    {
      id: 'curator',
      name: 'Mixtape Curator',
      price: '$9.99',
      period: '/month',
      features: [
        'Everything in Pro',
        'Create and join broadcasts'
      ],
      color: '#10B981',
      gradient: ['#10B981', '#059669'],
    }
  ];

  const handleSubscribe = async () => {
    try {
      setIsProcessing(true);

      // For basic plan, just update subscription without payment
      if (selectedPlan === 'basic') {
        await api.post('/user/subscription', { plan: 'basic' });
        await refreshSubscription();
        onClose();
        return;
      }

      // Validate email for paid plans
      if (selectedPlan !== 'basic' && !billingEmail.includes('@')) {
        Alert.alert('Email Required', 'Please enter a valid email address for billing.');
        return;
      }

      // For paid plans, open checkout in in-app browser
      const response = await api.post('/user/subscription', { 
        plan: selectedPlan,
        email: selectedPlan !== 'basic' ? billingEmail : undefined
      });
      
      if (response.data.requiresPayment && response.data.paymentUrl) {
        const result = await WebBrowser.openBrowserAsync(response.data.paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        
        // Check if user completed or cancelled payment
        if (result.type === 'cancel') {
          // User cancelled, no action needed
        } else if (result.type === 'dismiss') {
          // User dismissed after potentially completing payment
          await refreshSubscription();
          onClose();
        }
      } else {
        // Subscription created without payment required
        await refreshSubscription();
        onClose();
      }
    } catch (error) {
      console.error('Subscription error:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        errors: error.response?.data?.errors,
        plan: selectedPlan,
        message: error.message
      });
      Alert.alert(
        'Subscription Error', 
        error.response?.data?.error || 'Failed to create subscription. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        scrollEventThrottle={16}
      >
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.iconContainer}>
                <Text style={styles.heroIcon}>⭐</Text>
              </View>
              <Text style={styles.heroTitle}>Unlock the Full{'\n'}Mixtape Experience</Text>
              <Text style={styles.heroSubtitle}>
                Share unlimited music, join endless groups, and discover your next favorite song
              </Text>
            </View>

            {/* Subscription Plans */}
            <View style={styles.plansContainer}>
              {subscriptionPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    selectedPlan === plan.id && styles.selectedPlanCard,
                    plan.popular && styles.popularPlanCard,
                  ]}
                  onPress={() => setSelectedPlan(plan.id)}
                  activeOpacity={0.8}
                >
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Most Popular</Text>
                    </View>
                  )}
                  
                  <View style={styles.planHeader}>
                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.planPrice}>{plan.price}</Text>
                      {plan.period && <Text style={styles.planPeriod}>{plan.period}</Text>}
                    </View>
                  </View>

                  <View style={styles.featuresContainer}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <Ionicons 
                          name="checkmark-circle" 
                          size={16} 
                          color={plan.color} 
                          style={styles.featureIcon}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {selectedPlan === plan.id && (
                    <View style={[styles.selectedIndicator, { backgroundColor: plan.color }]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Email Input for Paid Plans */}
            {selectedPlan !== 'basic' && (
              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Billing Email</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Enter your email address"
                  value={billingEmail}
                  onChangeText={setBillingEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[
                styles.subscribeButton,
                { backgroundColor: subscriptionPlans.find(p => p.id === selectedPlan)?.color || theme.colors.primaryButton }
              ]}
              onPress={handleSubscribe}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              {isProcessing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.subscribeButtonText}>
                    {selectedPlan === 'basic' ? 'Continue with Basic' : `Upgrade to ${subscriptionPlans.find(p => p.id === selectedPlan)?.name}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By subscribing, you agree to our Terms of Service and Privacy Policy. 
                Cancel anytime in Settings.
              </Text>
            </View>
          </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surfaceWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderLight,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primaryButton}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  heroIcon: {
    fontSize: 40,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: theme.spacing.md,
  },
  heroSubtitle: {
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.4,
    maxWidth: width * 0.8,
  },
  plansContainer: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  planCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    position: 'relative',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedPlanCard: {
    borderColor: theme.colors.primaryButton,
    shadowColor: theme.colors.primaryButton,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  popularPlanCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.02)',
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: theme.spacing.lg,
    backgroundColor: theme.colors.primaryButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  popularBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  planHeader: {
    marginBottom: theme.spacing.lg,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: theme.spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 34,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },
  planPeriod: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  featuresContainer: {
    gap: theme.spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    marginRight: theme.spacing.sm,
  },
  featureText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    letterSpacing: -0.3,
    flex: 1,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    transform: [{ translateX: 8 }, { translateY: -8 }],
  },
  emailContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  emailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.3,
  },
  emailInput: {
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  subscribeButton: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.md + theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subscribeButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: theme.spacing.xs,
    letterSpacing: -0.2,
  },
  termsContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
});

export default SubscriptionScreen;