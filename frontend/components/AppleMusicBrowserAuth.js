import React from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import webViewMusicKitService from '../services/webViewMusicKitService';

// Simple browser-based Apple Music auth as fallback
class AppleMusicBrowserAuth {
  static async authenticate() {
    try {
      console.log('🍎 Starting browser-based Apple Music authentication...');
      
      // Get developer token
      const developerToken = await webViewMusicKitService.getDeveloperToken();
      
      // Create a simple auth URL that redirects to a page with MusicKit
      const authUrl = `https://mixtape-production.up.railway.app/api/oauth/apple/safari-auth?developerToken=${encodeURIComponent(developerToken)}&state=browser_auth_${Date.now()}`;
      
      console.log('🔗 Opening Apple Music auth in browser:', authUrl);
      
      // Open browser
      const result = await WebBrowser.openBrowserAsync(authUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: 'pageSheet',
      });
      
      if (result.type === 'cancel') {
        return {
          success: false,
          cancelled: true,
          status: 'denied'
        };
      }
      
      // For now, return demo success since real auth needs deep link handling
      console.log('🎭 Using demo auth for testing...');
      
      // Use demo auth
      const demoResponse = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/demo-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: `demo_user_${Date.now()}`,
          deviceType: 'ios'
        })
      });
      
      const demoResult = await demoResponse.json();
      
      if (demoResult.success) {
        // Exchange demo token with backend
        const exchangeResult = await webViewMusicKitService.exchangeTokenWithBackend(demoResult.musicUserToken);
        
        return {
          success: true,
          status: 'authorized',
          cancelled: false,
          token: exchangeResult.token,
          userInfo: exchangeResult.user,
          platform: exchangeResult.platform
        };
      } else {
        throw new Error('Demo auth failed');
      }
      
    } catch (error) {
      console.error('❌ Browser Apple Music auth failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default AppleMusicBrowserAuth;