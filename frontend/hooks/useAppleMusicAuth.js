import { useState, useEffect, useCallback } from 'react';
import { Linking, Alert } from 'react-native';
import nativeMusicKitService from '../services/nativeMusicKitService';
import appleMusicAuthSession from '../services/appleMusicAuthSession';

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
      console.log('🎵 Starting Apple Music authentication...');
      
      // Try AuthSession first (should work now with fixed bundle ID + MusicKit enabled)
      console.log('🍎 Attempting AuthSession authentication...');
      
      await appleMusicAuthSession.initialize();
      const authSessionResult = await appleMusicAuthSession.requestAuthorization();
      
      if (authSessionResult.cancelled) {
        setIsAuthenticating(false);
        return { cancelled: true };
      }
      
      if (authSessionResult.success) {
        console.log('✅ AuthSession Apple Music authentication successful!');
        
        // Set the result for compatibility with existing code
        const result = {
          success: true,
          status: 'authorized',
          cancelled: false,
          token: authSessionResult.userToken || authSessionResult.musicUserToken,
          userToken: authSessionResult.musicUserToken,
          userInfo: authSessionResult.userInfo,
          platform: 'apple-music'
        };
        
        setAuthResult(result);
        setIsAuthenticating(false);
        
        return { success: true, data: result };
      }
      
      // If AuthSession failed, fall back to native approach
      console.log('🔄 AuthSession failed, falling back to native approach...');
      
      // Initialize the native service
      await nativeMusicKitService.initialize();
      
      // Use native MusicKit authentication
      console.log('🍎 Requesting native Apple Music authorization...');
      const nativeResult = await nativeMusicKitService.authenticateUser();
      
      if (nativeResult.cancelled) {
        setIsAuthenticating(false);
        return { cancelled: true };
      }
      
      if (nativeResult.success) {
        console.log('✅ Native Apple Music authentication successful!');
        
        // Set the result
        setAuthResult(nativeResult);
        setIsAuthenticating(false);
        
        return { success: true, data: nativeResult };
      }
      
      // If we get here, both methods failed
      throw new Error(nativeResult.error || 'All authentication methods failed');
      
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