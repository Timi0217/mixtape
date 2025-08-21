import { useState, useEffect, useCallback } from 'react';
import { Linking, Alert } from 'react-native';
import nativeMusicKitService from '../services/nativeMusicKitService';
import appleMusicAuthSession from '../services/appleMusicAuthSession';
import webViewMusicKitService from '../services/webViewMusicKitService';
import AppleMusicBrowserAuth from '../components/AppleMusicBrowserAuth';

export const useAppleMusicAuth = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [showWebView, setShowWebView] = useState(false);

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
      
      // Use WebView approach (the working solution from GitHub repos)
      console.log('🍎 Using WebView + MusicKit.js approach...');
      
      // Show WebView modal
      setShowWebView(true);
      
      // Return in progress state - WebView will handle the rest
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

  const handleWebViewSuccess = useCallback((result) => {
    console.log('✅ WebView authentication successful!', result);
    
    setShowWebView(false);
    setIsAuthenticating(false);
    setAuthResult({
      success: true,
      status: 'authorized',
      cancelled: false,
      token: result.token,
      userToken: result.token,
      userInfo: result.user,
      platform: result.platform
    });
  }, []);

  const handleWebViewError = useCallback((error) => {
    console.error('❌ WebView authentication failed:', error);
    
    setShowWebView(false);
    setIsAuthenticating(false);
    setAuthResult({
      success: false,
      error: error
    });
  }, []);

  const handleWebViewCancel = useCallback(() => {
    console.log('🚫 User cancelled WebView authentication');
    
    setShowWebView(false);
    setIsAuthenticating(false);
    setAuthResult({
      success: false,
      cancelled: true,
      status: 'denied'
    });
  }, []);

  const resetAuth = useCallback(() => {
    setIsAuthenticating(false);
    setAuthResult(null);
    setShowWebView(false);
  }, []);

  return {
    isAuthenticating,
    authResult,
    showWebView,
    authenticateWithAppleMusic,
    handleWebViewSuccess,
    handleWebViewError,
    handleWebViewCancel,
    resetAuth
  };
};