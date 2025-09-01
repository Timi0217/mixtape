import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Animated, Dimensions, LinearGradient } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [isProcessing, setIsProcessing] = useState(false);
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
        'Share 1 song per day',
        'Join up to 3 groups',
        'Basic music discovery',
        'Standard support'
      ],
      color: '#8e8e93',
      gradient: ['#f8f9fa', '#e9ecef'],
    },
    {
      id: 'premium',
      name: 'Mixtape Premium',
      price: '$4.99',
      period: '/month',
      features: [
        'Unlimited song sharing',
        'Join unlimited groups',
        'Advanced music discovery',
        'Priority support',
        'Exclusive playlists',
        'Early access to features'
      ],
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#7C3AED'],
      popular: true,
    },
    {
      id: 'pro',
      name: 'Mixtape Pro',
      price: '$9.99',
      period: '/month',
      features: [
        'Everything in Premium',
        'Create unlimited groups',
        'Advanced analytics',
        'Custom group themes',
        'API access',
        'White-label options'
      ],
      color: '#10B981',
      gradient: ['#10B981', '#059669'],
    }
  ];

  const handleSubscribe = async () => {
    setIsProcessing(true);
    // Simulate subscription process
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 2000);
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
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />
      <Animated.View 
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
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
          >
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.iconContainer}>
                <Ionicons name="musical-notes" size={40} color={theme.colors.primaryButton} />
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
                    {selectedPlan === 'basic' ? 'Continue with Basic' : 'Start Free Trial'}
                  </Text>
                  {selectedPlan !== 'basic' && (
                    <Text style={styles.subscribeButtonSubtext}>
                      7 days free, then {subscriptionPlans.find(p => p.id === selectedPlan)?.price}{subscriptionPlans.find(p => p.id === selectedPlan)?.period}
                    </Text>
                  )}
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
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surfaceWhite,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: height * 0.9,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  safeArea: {
    flex: 1,
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
    borderColor: theme.colors.primaryButton,
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