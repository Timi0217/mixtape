import { useState, useEffect, useCallback } from 'react';
import { Linking, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import musicKitService from '../services/musicKitService';

export const useAppleMusicAuth = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authResult, setAuthResult] = useState(null);

  // Handle deep link callbacks from MusicKit
  useEffect(() => {
    const handleDeepLink = (url) => {
      console.log('🔗 Received deep link:', url);
      
      if (url.includes('apple-music-auth')) {
        handleMusicKitCallback(url);
      }
    };

    // Set up deep link listener
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleMusicKitCallback = async (url) => {
    try {
      console.log('🎵 Processing MusicKit callback:', url);
      
      // Extract music user token from URL
      const urlObj = new URL(url);
      const musicUserToken = urlObj.searchParams.get('music_user_token');
      
      if (musicUserToken) {
        console.log('✅ Music User Token received');
        
        // Exchange token with backend
        const result = await musicKitService.exchangeTokenWithBackend(musicUserToken);
        
        setAuthResult({
          success: true,
          token: result.token,
          user: result.user,
          platform: result.platform
        });
      } else {
        throw new Error('No Music User Token in callback URL');
      }
    } catch (error) {
      console.error('❌ MusicKit callback processing failed:', error);
      setAuthResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const authenticateWithAppleMusic = useCallback(async () => {
    setIsAuthenticating(true);
    setAuthResult(null);

    try {
      console.log('🍎 Starting Apple Music authentication flow...');
      
      // Step 1: Get Apple user info (optional)
      let userInfo = null;
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (isAvailable) {
          console.log('📱 Getting Apple user identity...');
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          
          userInfo = {
            id: credential.user,
            email: credential.email,
            name: credential.fullName ? 
              `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() || 'Apple Music User' : 
              'Apple Music User'
          };
          
          console.log('✅ Apple user identity obtained:', userInfo.name);
        }
      } catch (identityError) {
        if (identityError.code === 'ERR_CANCELED') {
          setIsAuthenticating(false);
          return { cancelled: true };
        }
        console.log('ℹ️ Continuing without Apple user identity:', identityError.message);
      }
      
      // Step 2: Authenticate with MusicKit
      console.log('🎵 Opening MusicKit authorization...');
      const result = await musicKitService.authenticateWithWebView();
      
      if (result.type === 'cancel') {
        setIsAuthenticating(false);
        return { cancelled: true };
      }
      
      // Authentication continues via deep link callback
      return { inProgress: true };
      
    } catch (error) {
      console.error('❌ Apple Music authentication failed:', error);
      setIsAuthenticating(false);
      setAuthResult({
        success: false,
        error: error.message
      });
      return { error: error.message };
    }
  }, []);

  const resetAuth = useCallback(() => {
    setIsAuthenticating(false);
    setAuthResult(null);
  }, []);

  return {
    isAuthenticating,
    authResult,
    authenticateWithAppleMusic,
    resetAuth
  };
};