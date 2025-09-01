import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import AppNavigator from './navigation/AppNavigator';
import LoginScreen from './screens/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import notificationService from './services/notificationService';
import networkService from './services/networkService';
import OfflineBanner from './components/OfflineBanner';

const AppContent = () => {
  const { isAuthenticated, loading, login } = useAuth();

  useEffect(() => {
    // Initialize network monitoring
    networkService.initialize();

    // Initialize notifications when user is authenticated
    if (isAuthenticated) {
      notificationService.initialize().catch(console.error);
    }

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, [isAuthenticated]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <OfflineBanner />
        <LoginScreen onLoginSuccess={login} />
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <StripeProvider publishableKey="pk_live_51S2aRHDDGKTNxzebuw8ypoUd2ixkEPiLjQY1gC3w5qKy64b1YgAlfbwTrnMLLsIeJDFrGrlPak4YcwTRob1D6zHc00tDhvhpcQ">
      <AuthProvider>
        <SubscriptionProvider>
          <AppContent />
          <StatusBar style="auto" />
        </SubscriptionProvider>
      </AuthProvider>
    </StripeProvider>
  );
}