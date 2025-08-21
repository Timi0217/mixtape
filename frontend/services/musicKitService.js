import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import api from './api';

class MusicKitService {
  constructor() {
    this.musicKitConfig = null;
    this.isInitialized = false;
  }

  // Initialize MusicKit with backend configuration
  async initialize() {
    try {
      console.log('🍎 Initializing MusicKit service...');
      
      // Get MusicKit configuration from backend
      const response = await api.get('/oauth/apple-music/login');
      this.musicKitConfig = response.data.musicKitConfig;
      this.state = response.data.state;
      
      console.log('✅ MusicKit configuration received:', {
        hasDevToken: !!this.musicKitConfig.developerToken,
        appName: this.musicKitConfig.app.name
      });
      
      this.isInitialized = true;
      return this.musicKitConfig;
    } catch (error) {
      console.error('❌ Failed to initialize MusicKit:', error);
      throw new Error('Failed to initialize Apple Music service');
    }
  }

  // Authenticate with Apple Music using WebView approach
  async authenticate() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔐 Starting Apple Music authentication...');
      
      // Create MusicKit authorization URL for web
      const authUrl = this.createMusicKitAuthUrl();
      
      console.log('🌐 Opening MusicKit authorization:', authUrl);
      
      // Open MusicKit authorization in browser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'mixtape://apple-music-auth',
        {
          dismissButtonStyle: 'close',
          presentationStyle: 'pageSheet'
        }
      );

      if (result.type === 'success' && result.url) {
        // Extract music user token from callback URL
        const musicUserToken = this.extractTokenFromUrl(result.url);
        
        if (musicUserToken) {
          console.log('✅ Music User Token obtained successfully');
          return musicUserToken;
        } else {
          throw new Error('Failed to extract Music User Token from callback');
        }
      } else if (result.type === 'cancel') {
        throw new Error('User cancelled Apple Music authorization');
      } else {
        throw new Error('Apple Music authorization failed');
      }
    } catch (error) {
      console.error('❌ Apple Music authentication failed:', error);
      throw error;
    }
  }

  // Create MusicKit authorization URL
  createMusicKitAuthUrl() {
    const baseUrl = 'https://authorize.music.apple.com/woa';
    const params = new URLSearchParams({
      app_name: this.musicKitConfig.app.name,
      app_id: 'host.exp.Exponent', // Use Expo app ID
      developer_token: this.musicKitConfig.developerToken,
      state: this.state,
      redirect_uri: 'mixtape://apple-music-auth'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  // Extract music user token from callback URL
  extractTokenFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const musicUserToken = urlObj.searchParams.get('music_user_token');
      return musicUserToken;
    } catch (error) {
      console.error('Failed to extract token from URL:', error);
      return null;
    }
  }

  // Exchange Music User Token with backend
  async exchangeTokenWithBackend(musicUserToken, userInfo = null) {
    try {
      console.log('🔄 Exchanging Music User Token with backend...');
      
      const response = await api.post('/oauth/apple-music/exchange', {
        musicUserToken,
        userInfo
      });
      
      if (response.data.success) {
        console.log('✅ Token exchange successful');
        return {
          token: response.data.token,
          user: response.data.user,
          platform: response.data.platform
        };
      } else {
        throw new Error(response.data.message || 'Token exchange failed');
      }
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      
      if (error.response?.status === 400) {
        throw new Error('Invalid Apple Music token. Please ensure you authorized with Apple Music, not Apple ID.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to authenticate with Apple Music');
    }
  }

  // Complete Apple Music authentication flow
  async authenticateComplete(userInfo = null) {
    try {
      // Step 1: Get Music User Token
      const musicUserToken = await this.authenticate();
      
      // Step 2: Exchange with backend
      const result = await this.exchangeTokenWithBackend(musicUserToken, userInfo);
      
      return result;
    } catch (error) {
      console.error('❌ Complete Apple Music authentication failed:', error);
      throw error;
    }
  }

  // Use direct Apple Music authorization (no JavaScript needed)
  async authenticateWithSafari() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔗 Using direct Apple Music authorization URL...');
      
      // Use Apple's direct authorization URL (bypasses JavaScript completely)
      const directAuthUrl = `https://authorize.music.apple.com/woa?app_name=${encodeURIComponent(this.musicKitConfig.app.name)}&app_id=host.exp.Exponent&developer_token=${encodeURIComponent(this.musicKitConfig.developerToken)}&redirect_uri=${encodeURIComponent('mixtape://apple-music-auth')}&state=${encodeURIComponent(this.state)}`;
      
      console.log('🌐 Opening direct Apple Music auth:', directAuthUrl.substring(0, 100) + '...');
      
      // Open Apple's official authorization page directly
      const result = await WebBrowser.openAuthSessionAsync(
        directAuthUrl,
        'mixtape://apple-music-auth',
        {
          preferEphemeralSession: false,
          showInRecents: false,
          dismissButtonStyle: 'close',
        }
      );

      console.log('🔄 Direct auth result:', result);
      return result;
    } catch (error) {
      console.error('❌ Direct Apple Music authentication failed:', error);
      throw error;
    }
  }

  // Use WebView-based MusicKit approach for React Native (DEPRECATED)
  async authenticateWithWebView() {
    console.log('⚠️ WebView approach deprecated, using Safari instead...');
    return this.authenticateWithSafari();
  }

  // Alternative: Direct MusicKit authorization URL approach
  async authenticateWithDirectURL() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔗 Using direct MusicKit authorization URL...');
      
      // Use the official Apple Music authorization URL
      const authUrl = `https://authorize.music.apple.com/woa?app_name=${encodeURIComponent(this.musicKitConfig.app.name)}&app_id=host.exp.Exponent&developer_token=${encodeURIComponent(this.musicKitConfig.developerToken)}&redirect_uri=${encodeURIComponent('mixtape://apple-music-auth')}&state=${encodeURIComponent(this.state)}`;
      
      console.log('🌐 Opening authorization URL:', authUrl.substring(0, 100) + '...');
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'mixtape://apple-music-auth',
        {
          dismissButtonStyle: 'close',
          presentationStyle: 'pageSheet'
        }
      );

      console.log('🔄 Auth session result:', result);
      return result;
    } catch (error) {
      console.error('❌ Direct URL MusicKit authentication failed:', error);
      throw error;
    }
  }

  // Deploy auth page to a real domain for Safari compatibility
  async deployAuthPage() {
    try {
      // Always use production URL for Safari auth (since localhost doesn't work on mobile)
      const baseUrl = 'https://mixtape-production.up.railway.app';
      
      // Create auth page URL with state parameter
      const authPageUrl = `${baseUrl}/api/oauth/apple/safari-auth?state=${encodeURIComponent(this.state)}&developerToken=${encodeURIComponent(this.musicKitConfig.developerToken)}`;
      
      console.log('🌐 Auth page URL generated:', authPageUrl);
      return authPageUrl;
    } catch (error) {
      console.error('❌ Failed to create auth page URL:', error);
      throw error;
    }
  }

  // Create HTML page with MusicKit.js integration
  createMusicKitWebPage() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Apple Music Authorization</title>
        <script src="https://js-cdn.music.apple.com/musickit/v1/musickit.js"></script>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
          }
          .container {
            max-width: 400px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px 30px;
            backdrop-filter: blur(10px);
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 18px;
            margin-bottom: 30px;
            opacity: 0.9;
          }
          .auth-btn {
            background: #000;
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 32px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin: 10px 0;
          }
          .auth-btn:hover {
            background: #333;
          }
          .status {
            margin-top: 20px;
            font-size: 14px;
            opacity: 0.8;
          }
          .error {
            color: #ffcdd2;
            background: rgba(244, 67, 54, 0.2);
            padding: 10px;
            border-radius: 8px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎵 Mixtape</div>
          <div class="subtitle">Connect Apple Music</div>
          
          <button id="authorize-btn" class="auth-btn">
            Authorize Apple Music
          </button>
          
          <div id="status" class="status">
            Click to authorize Apple Music access
          </div>
          
          <div id="error" class="error" style="display: none;"></div>
        </div>

        <script>
          document.addEventListener('DOMContentLoaded', async function() {
            try {
              const statusEl = document.getElementById('status');
              const errorEl = document.getElementById('error');
              const btnEl = document.getElementById('authorize-btn');
              
              statusEl.textContent = 'Initializing Apple Music...';
              
              // Configure MusicKit
              await MusicKit.configure({
                developerToken: '${this.musicKitConfig.developerToken}',
                app: {
                  name: '${this.musicKitConfig.app.name}',
                  build: '${this.musicKitConfig.app.build}'
                }
              });
              
              const music = MusicKit.getInstance();
              statusEl.textContent = 'Ready to authorize';
              
              btnEl.addEventListener('click', async function() {
                try {
                  btnEl.textContent = 'Authorizing...';
                  btnEl.disabled = true;
                  statusEl.textContent = 'Requesting Apple Music permission...';
                  
                  const musicUserToken = await music.authorize();
                  
                  if (musicUserToken) {
                    statusEl.textContent = 'Success! Redirecting...';
                    
                    // Redirect back to app with token
                    window.location.href = 'mixtape://apple-music-auth?music_user_token=' + encodeURIComponent(musicUserToken);
                  } else {
                    throw new Error('No Music User Token received');
                  }
                } catch (error) {
                  console.error('Authorization failed:', error);
                  errorEl.textContent = 'Authorization failed: ' + error.message;
                  errorEl.style.display = 'block';
                  btnEl.textContent = 'Try Again';
                  btnEl.disabled = false;
                  statusEl.textContent = 'Authorization failed';
                }
              });
              
            } catch (error) {
              console.error('MusicKit initialization failed:', error);
              document.getElementById('error').textContent = 'Failed to initialize Apple Music: ' + error.message;
              document.getElementById('error').style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  // Check if MusicKit is available (always true for web-based approach)
  isAvailable() {
    return true;
  }
}

export default new MusicKitService();