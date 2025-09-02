import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SubscriptionContext = createContext(undefined);

const SUBSCRIPTION_DATA_KEY = '@mixtape:subscription_data';

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadSubscriptionData();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Try to load from local storage first for offline support
      const storedData = await AsyncStorage.getItem(SUBSCRIPTION_DATA_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setSubscription(parsedData);
      }

      // Fetch fresh data from server
      const response = await api.get('/user/subscription');
      if (response.data) {
        const subscriptionData = response.data;
        setSubscription(subscriptionData);
        
        // Store updated data locally
        await AsyncStorage.setItem(SUBSCRIPTION_DATA_KEY, JSON.stringify(subscriptionData));
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      // Set default free subscription if API fails
      const defaultSubscription = {
        plan: 'basic',
        status: 'active',
        features: {
          maxSongsPerDay: 1,
          maxGroups: 1,
          hasAdvancedDiscovery: false,
          hasPrioritySupport: false,
          hasExclusivePlaylists: false,
          canCreateGroups: true,
          hasAnalytics: false,
          hasCustomThemes: false,
          hasApiAccess: false,
        },
      };
      setSubscription(defaultSubscription);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (planId) => {
    try {
      setLoading(true);
      
      // Call subscription API
      const response = await api.post('/user/subscription', { plan: planId });
      
      if (response.data) {
        const newSubscription = response.data;
        setSubscription(newSubscription);
        
        // Store updated data locally
        await AsyncStorage.setItem(SUBSCRIPTION_DATA_KEY, JSON.stringify(newSubscription));
        
        return { success: true, subscription: newSubscription };
      }
    } catch (error) {
      console.error('Subscription failed:', error);
      return { success: false, error: error.message || 'Subscription failed' };
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setLoading(true);
      
      await api.delete('/user/subscription');
      
      // Revert to basic plan
      const basicSubscription = {
        plan: 'basic',
        status: 'active',
        features: {
          maxSongsPerDay: 1,
          maxGroups: 1,
          hasAdvancedDiscovery: false,
          hasPrioritySupport: false,
          hasExclusivePlaylists: false,
          canCreateGroups: true,
          hasAnalytics: false,
          hasCustomThemes: false,
          hasApiAccess: false,
        },
      };
      
      setSubscription(basicSubscription);
      await AsyncStorage.setItem(SUBSCRIPTION_DATA_KEY, JSON.stringify(basicSubscription));
      
      return { success: true };
    } catch (error) {
      console.error('Cancellation failed:', error);
      return { success: false, error: error.message || 'Cancellation failed' };
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (feature) => {
    if (!subscription || !subscription.features) return false;
    return subscription.features[feature] === true;
  };

  const isPremium = () => {
    return subscription?.plan === 'pro' || subscription?.plan === 'curator';
  };

  const isPro = () => {
    return subscription?.plan === 'pro';
  };

  const isCurator = () => {
    return subscription?.plan === 'curator';
  };

  const canPerformAction = (action) => {
    if (!subscription) return false;
    
    switch (action) {
      case 'shareUnlimitedSongs':
        return isPremium();
      case 'joinUnlimitedGroups':
        return isPremium();
      case 'createGroups':
        return isPro();
      case 'accessAnalytics':
        return isPro();
      case 'customizeThemes':
        return isPro();
      case 'useApi':
        return isPro();
      default:
        return true; // Basic features available to all
    }
  };

  const getFeatureLimits = () => {
    if (!subscription?.features) {
      return {
        maxSongsPerDay: 1,
        maxGroups: 1,
      };
    }
    
    return {
      maxSongsPerDay: subscription.features.maxSongsPerDay || 1,
      maxGroups: subscription.features.maxGroups || 1,
    };
  };

  const value = {
    subscription,
    loading,
    subscribe,
    cancelSubscription,
    hasFeature,
    isPremium,
    isPro,
    isCurator,
    canPerformAction,
    getFeatureLimits,
    refreshSubscription: loadSubscriptionData,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};