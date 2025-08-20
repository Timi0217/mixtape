import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  StatusBar,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
// Removed: Apple Sign In - now only using Apple Music MusicKit authentication
import { setAuthToken } from '../services/api';
import api from '../services/api';
import musicKitService from '../services/musicKitService';
import { useAppleMusicAuth } from '../hooks/useAppleMusicAuth';

const { width, height } = Dimensions.get('window');

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

const LoginScreen = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  // Apple Music authentication hook
  const { 
    isAuthenticating: isAppleMusicAuthenticating, 
    authResult: appleMusicAuthResult,
    authenticateWithAppleMusic,
    resetAuth: resetAppleMusicAuth
  } = useAppleMusicAuth();

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Handle Apple Music authentication results
  useEffect(() => {
    if (appleMusicAuthResult) {
      if (appleMusicAuthResult.success) {
        console.log('✅ Apple Music authentication successful!');
        handleOAuthSuccess(appleMusicAuthResult.token, appleMusicAuthResult.platform);
      } else {
        console.error('❌ Apple Music authentication failed:', appleMusicAuthResult.error);
        Alert.alert(
          'Apple Music Failed', 
          appleMusicAuthResult.error || 'Authentication failed'
        );
        setLoading(null);
      }
      resetAppleMusicAuth();
    }
  }, [appleMusicAuthResult]);

  const handleOAuthSuccess = async (token, platform) => {
    try {
      console.log('🎯 Starting handleOAuthSuccess with token:', token ? `${token.substring(0, 20)}...` : 'null');
      console.log('Platform:', platform);
      
      console.log('💾 Setting auth token...');
      setAuthToken(token);
      
      console.log('👤 Getting user info from backend...');
      const response = await api.get('/oauth/me');
      console.log('✅ User info response:', response.data);
      const userData = response.data.user;
      
      console.log('🚀 Calling onLoginSuccess...');
      onLoginSuccess(token, userData);
      console.log('✅ Login success complete!');
    } catch (error) {
      console.error('❌ Failed to get user info:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Login Failed', 'Failed to retrieve user information');
    } finally {
      console.log('🧹 Clearing loading state...');
      setLoading(null);
    }
  };

  const startTokenPolling = (tokenId, platform, browserTask) => {
    console.log('Starting token polling for:', tokenId);
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 5 minutes (5 seconds * 60)
    
    const interval = setInterval(async () => {
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts} for token:`, tokenId);
      
      try {
        const response = await api.get(`/oauth/check-token/${tokenId}`);
        
        if (response.data.success) {
          console.log('✅ Token found! OAuth successful - dismissing browser');
          clearInterval(interval);
          setPollingInterval(null);
          
          // Automatically dismiss the browser
          if (browserTask) {
            WebBrowser.dismissBrowser();
          }
          
          // Handle the successful token
          await handleOAuthSuccess(response.data.token, response.data.platform);
        } else if (attempts >= maxAttempts) {
          console.log('❌ Polling timeout reached');
          clearInterval(interval);
          setPollingInterval(null);
          setLoading(null);
          
          Alert.alert(
            'Login Timeout',
            'The login process took too long. Please try again.'
          );
        }
        // Otherwise continue polling...
        
      } catch (error) {
        console.error('Polling error:', error);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollingInterval(null);
          setLoading(null);
          
          Alert.alert(
            'Login Failed', 
            'Unable to complete login. Please try again.'
          );
        }
      }
    }, 2000); // Poll every 2 seconds for faster detection
    
    setPollingInterval(interval);
  };





  const handleSpotifyLogin = async () => {
    // Stop any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setLoading('spotify');
    try {
      // Get auth URL from backend
      const response = await api.get('/oauth/spotify/login');
      const { authUrl, state, tokenId } = response.data;
      
      console.log('Opening Spotify auth URL:', authUrl);
      console.log('OAuth state:', state);
      console.log('Token ID for polling:', tokenId);
      
      // Open OAuth flow in browser first
      const browserTask = WebBrowser.openBrowserAsync(authUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: 'pageSheet',
      });
      
      // Start polling immediately with browser reference for auto-dismissal
      console.log('Starting polling immediately for OAuth completion');
      startTokenPolling(tokenId, 'spotify', browserTask);
      
      // Handle browser close events
      browserTask.then((result) => {
        if (result.type === 'cancel') {
          console.log('User cancelled OAuth flow - stopping polling');
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setLoading(null);
        }
      });
      
    } catch (error) {
      console.error('Spotify login error:', error);
      Alert.alert('Login Failed', 'Failed to start Spotify login.');
      setLoading(null);
    }
  };

  const handleAppleMusicLogin = async () => {
    // Stop any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setLoading('apple');
    
    try {
      console.log('🍎 Starting Apple Music authentication with MusicKit...');
      
      // Use WebView approach with MusicKit.js (most reliable for React Native)
      await musicKitService.initialize();
      
      console.log('🌐 Using WebView MusicKit approach...');
      const webViewResult = await musicKitService.authenticateWithWebView();
      
      if (webViewResult.type === 'cancel') {
        console.log('User cancelled MusicKit WebView authentication');
        setLoading(null);
        return;
      }
      
      // For WebView, we rely on deep linking callback
      console.log('🔄 Waiting for MusicKit callback via deep link...');
      
      // Set a timeout to prevent infinite loading if callback fails
      setTimeout(() => {
        if (loading === 'apple') {
          console.log('⏰ Apple Music authentication timeout reached');
          setLoading(null);
          Alert.alert(
            'Authentication Timeout',
            'Apple Music authentication took too long. Please try again or use Spotify.',
            [
              { text: 'Try Again', onPress: () => handleAppleMusicLogin() },
              { text: 'Use Spotify', onPress: () => handleSpotifyLogin() },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      }, 30000); // 30 second timeout
      
      // The useAppleMusicAuth hook will handle the callback
        
    } catch (error) {
      console.error('❌ Apple Music authentication failed:', error);
      setLoading(null);
      
      // Fallback: Show user a helpful message about Apple Music setup
      Alert.alert(
        'Apple Music Setup',
        'Apple Music authentication requires MusicKit to be enabled in Apple Developer Console. For now, please use Spotify to create and share playlists.',
        [
          {
            text: 'Use Spotify',
            onPress: () => handleSpotifyLogin(),
            style: 'default'
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.bgPrimary} />
      
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.appTitle}>Mixtape</Text>
          <Text style={styles.tagline}>Daily music with friends and lovers 💛</Text>
          
          {/* Value Props */}
          <View style={styles.valueProps}>
            <View style={styles.valueProp}>
              <Text style={styles.valuePropText} numberOfLines={1}>⏰ Submit at 11pm</Text>
            </View>
            <View style={styles.valueProp}>
              <Text style={styles.valuePropText} numberOfLines={1}>🎵 Listen at 8am</Text>
            </View>
          </View>
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <Text style={styles.loginPrompt}>CONNECT YOUR MUSIC</Text>
          
          {/* Spotify Button */}
          <TouchableOpacity
            style={[styles.loginButton, styles.spotifyButton]}
            onPress={handleSpotifyLogin}
            disabled={loading !== null}
            activeOpacity={0.7}
          >
            <View style={styles.buttonContent}>
              {loading === 'spotify' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.spotifyButtonText}>Continue with Spotify</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Apple Music Button */}
          <TouchableOpacity
            style={[styles.loginButton, styles.appleMusicButton]}
            onPress={handleAppleMusicLogin}
            disabled={loading !== null}
            activeOpacity={0.7}
          >
            <View style={styles.buttonContent}>
              {loading === 'apple' || isAppleMusicAuthenticating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.appleMusicButtonText}>Continue with Apple Music</Text>
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            Connect to start sharing music with friends
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 50,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -2,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    // 3D text effect matching buttons
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
    // Additional depth shadows
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  
  // Value Props
  valueProps: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
  },
  valueProp: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    borderLeftColor: 'rgba(255, 255, 255, 0.9)',
    borderRightColor: 'rgba(0, 0, 0, 0.1)',
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    // Backup shadow for iOS
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  valuePropText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    numberOfLines: 1,
  },
  
  // Login Section
  loginSection: {
    paddingHorizontal: theme.spacing.xl,
  },
  loginPrompt: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    letterSpacing: -0.5,
  },
  
  // Login Buttons - Visible depth with layered borders
  loginButton: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 3,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.8)',
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    // Backup shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.lg,
  },
  
  // Spotify Button - Visible green depth
  spotifyButton: {
    backgroundColor: '#1DB954',
    borderWidth: 3,
    borderTopColor: '#2ECC71',
    borderLeftColor: '#2ECC71',
    borderRightColor: '#16A085',
    borderBottomColor: '#148F77',
    // Backup glow
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  spotifyButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.2,
  },
  
  // Apple Music Button - Visible red depth
  appleMusicButton: {
    backgroundColor: '#FC3C44',
    borderWidth: 3,
    borderTopColor: '#FF6B6B',
    borderLeftColor: '#FF6B6B',
    borderRightColor: '#E74C3C',
    borderBottomColor: '#C0392B',
    // Backup glow
    shadowColor: '#FC3C44',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  appleMusicButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.2,
  },
  
  // Privacy Note
  privacyNote: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
});

export default LoginScreen;