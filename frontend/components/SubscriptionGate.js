import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import SubscriptionScreen from '../screens/SubscriptionScreen';

const theme = {
  colors: {
    surfaceWhite: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#3c3c43',
    textTertiary: '#8e8e93',
    primaryButton: '#8B5CF6',
    borderLight: '#C6C6C8',
    shadow: 'rgba(0, 0, 0, 0.04)',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    md: 16,
  },
};

const SubscriptionGate = ({ 
  feature, 
  title, 
  description, 
  children, 
  showUpgrade = true 
}) => {
  const { canPerformAction } = useSubscription();
  const [showSubscription, setShowSubscription] = useState(false);

  const hasAccess = canPerformAction(feature);

  if (hasAccess) {
    return children;
  }

  if (!showUpgrade) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.gateCard}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={24} color={theme.colors.primaryButton} />
        </View>
        
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => setShowSubscription(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.upgradeButtonText}>Upgrade to Access</Text>
          <Ionicons name="arrow-forward" size={16} color="white" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showSubscription}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSubscription(false)}
      >
        <SubscriptionScreen onClose={() => setShowSubscription(false)} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  gateCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 300,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.primaryButton}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
    letterSpacing: -0.2,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primaryButton,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});

export default SubscriptionGate;