import React, { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import webViewMusicKitService from '../services/webViewMusicKitService';
import nativeMusicKitService from '../services/nativeMusicKitService';

// Configure WebBrowser for OAuth completion
WebBrowser.maybeCompleteAuthSession();

const AppleMusicWebViewAuth = ({ visible, onSuccess, onError, onCancel }) => {

  useEffect(() => {
    if (visible) {
      startAuthentication();
    }
  }, [visible]);

  const startAuthentication = async () => {
    try {
      console.log('🍎 Starting Apple Music authentication...');
      
      // Get developer token
      const developerToken = await webViewMusicKitService.getDeveloperToken();
      
      // Create auth URL with different parameters to force full Safari
      const authUrl = `https://mixtape-production.up.railway.app/api/oauth/apple/safari-auth?developerToken=${encodeURIComponent(developerToken)}&state=native_auth_${Date.now()}&redirect=mixtape://apple-music-success&mode=safari`;
      
      console.log('🚀 Opening Apple Music auth in Safari:', authUrl);
      
      // Listen for deep link response
      const handleDeepLink = (url) => {
        console.log('🔗 Received deep link:', url);
        
        if (url.includes('apple-music-success')) {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const error = urlObj.searchParams.get('error');
          
          if (token) {
            console.log('✅ Received Apple Music token from deep link');
            handleTokenReceived(token);
          } else if (error) {
            console.error('❌ Received error from deep link:', error);
            onError(error);
          } else {
            console.error('❌ No token received in callback');
            onError('Apple Music authentication failed - no token received');
          }
        }
      };
      
      // Set up deep link listener
      const subscription = Linking.addEventListener('url', handleDeepLink);
      
      // Use Linking.openURL to open in actual Safari instead of embedded browser
      await Linking.openURL(authUrl);
      
      // Don't remove listener immediately - wait for deep link
      setTimeout(() => {
        subscription?.remove();
        console.log('🔗 Deep link listener removed after timeout');
      }, 60000); // 1 minute timeout

    } catch (error) {
      console.error('❌ Auth failed:', error);
      onError(error.message);
    }
  };

  const handleTokenReceived = async (userToken) => {
    try {
      console.log('🔄 Exchanging token with backend...');
      
      const exchangeResult = await webViewMusicKitService.exchangeTokenWithBackend(userToken);
      onSuccess(exchangeResult);
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      onError(error.message);
    }
  };


  // Return null - no UI needed, just handle the auth flow
  return null;
};

export default AppleMusicWebViewAuth;