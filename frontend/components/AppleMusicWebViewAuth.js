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
      console.log('🍎 Starting Apple Music app redirect authentication...');
      
      // Use Apple Music app redirect approach (no MusicKit.js or developer token needed)
      const authUrl = `https://mixtape-production.up.railway.app/api/oauth/apple/app-redirect-auth?state=app_redirect_${Date.now()}&redirect=mixtape://apple-music-success`;
      
      console.log('🚀 Opening Apple Music app redirect in Safari:', authUrl);
      
      // Listen for deep link response
      const handleDeepLink = (url) => {
        console.log('🔗 Received deep link:', url);
        console.log('🔍 DEBUG: Deep link analysis:', {
          timestamp: new Date().toISOString(),
          fullUrl: url,
          isAppleMusicSuccess: url.includes('apple-music-success'),
          isAppleMusicError: url.includes('error='),
          urlLength: url.length
        });
        
        if (url.includes('apple-music-success')) {
          try {
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            const error = urlObj.searchParams.get('error');
            
            console.log('🔍 DEBUG: URL parameters:', {
              hasToken: !!token,
              tokenLength: token?.length || 0,
              hasError: !!error,
              errorValue: error,
              allParams: Object.fromEntries(urlObj.searchParams.entries())
            });
            
            if (token) {
              console.log('✅ Received Apple Music token from deep link');
              console.log('🔍 DEBUG: Token details:', {
                length: token.length,
                preview: token.substring(0, 50) + '...'
              });
              handleTokenReceived(token);
            } else if (error) {
              console.error('❌ Received error from deep link:', error);
              onError(error);
            } else {
              console.error('❌ No token received in callback');
              console.log('🔍 DEBUG: No token or error in URL params');
              onError('Apple Music authentication failed - no token received');
            }
          } catch (urlParseError) {
            console.error('❌ Failed to parse deep link URL:', urlParseError);
            console.log('🔍 DEBUG: URL parse error:', {
              error: urlParseError.message,
              url: url
            });
            onError('Failed to parse authentication response');
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
      console.log('🔍 DEBUG: Token received in component:', {
        timestamp: new Date().toISOString(),
        tokenExists: !!userToken,
        tokenLength: userToken?.length || 0,
        tokenPreview: userToken?.substring(0, 30) + '...',
        source: 'handleTokenReceived'
      });
      
      const exchangeResult = await webViewMusicKitService.exchangeTokenWithBackend(userToken);
      console.log('🔍 DEBUG: Exchange result:', {
        success: exchangeResult.success,
        hasToken: !!exchangeResult.token,
        hasUser: !!exchangeResult.user,
        platform: exchangeResult.platform
      });
      onSuccess(exchangeResult);
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      console.error('🔍 DEBUG: Component-level error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      onError(error.message);
    }
  };


  // Return null - no UI needed, just handle the auth flow
  return null;
};

export default AppleMusicWebViewAuth;