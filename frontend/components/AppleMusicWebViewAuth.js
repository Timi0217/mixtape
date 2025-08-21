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
      console.log('🍎 Starting native Apple Music authentication...');
      
      // Try native iOS MusicKit first
      const nativeResult = await nativeMusicKitService.requestAuthorization();
      
      if (nativeResult.status === 'authorized') {
        console.log('✅ Native Apple Music authorization successful');
        
        // Exchange the user token with backend
        const exchangeResult = await webViewMusicKitService.exchangeTokenWithBackend(nativeResult.userToken || nativeResult.musicUserToken);
        onSuccess(exchangeResult);
        return;
      } else {
        console.log('❌ Native authorization failed:', nativeResult.status);
        throw new Error(`Apple Music authorization ${nativeResult.status}: ${nativeResult.error || 'Please enable Apple Music in Settings'}`);
      }

    } catch (error) {
      console.error('❌ Native auth failed:', error);
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