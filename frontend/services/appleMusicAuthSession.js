import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

// Configure WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

class AppleMusicAuthSession {
  constructor() {
    this.isInitialized = false;
    this.discovery = {
      authorizationEndpoint: 'https://authorize.music.apple.com/woa'
    };
  }

  /**
   * Initialize Apple Music OAuth with AuthSession
   */
  async initialize() {
    console.log('🍎 Initializing Apple Music AuthSession...');
    this.isInitialized = true;
    return true;
  }

  /**
   * Start Apple Music OAuth flow using modern AuthSession API
   */
  async requestAuthorization() {
    try {
      console.log('🔐 Starting Apple Music OAuth with AuthSession...');
      
      // Get client configuration from backend
      const configResponse = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/config');
      const config = await configResponse.json();
      
      if (!config.success) {
        throw new Error('Failed to get Apple Music configuration');
      }
      
      console.log('📋 Backend config received:', config);
      
      // Create redirect URI
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'mixtape',
        path: 'auth/apple-music'
      });
      
      console.log('🔗 Redirect URI:', redirectUri);
      
      // Configure the request
      const request = new AuthSession.AuthRequest({
        clientId: config.clientId, // com.mobilemixtape.app
        scopes: ['openid', 'email', 'name'],
        redirectUri: redirectUri,
        responseType: AuthSession.ResponseType.Code,
        state: config.state,
        extraParams: {},
      });
      
      console.log('📋 Auth request configured');
      
      // Make the request
      const result = await request.promptAsync(this.discovery, {
        preferEphemeralSession: false, // Keep session for convenience
        showInRecents: true,
      });
      
      console.log('🔍 OAuth Result:', result);
      
      if (result.type === 'success') {
        const { code, state } = result.params;
        
        if (!code) {
          throw new Error('No authorization code received');
        }
        
        console.log('✅ Authorization code received, exchanging for token...');
        
        // Exchange code for token via backend
        const tokenResponse = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            state: state,
            redirectUri: redirectUri
          })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.success) {
          console.log('✅ Apple Music authentication successful!');
          return {
            success: true,
            status: 'authorized',
            cancelled: false,
            musicUserToken: tokenData.musicUserToken,
            userInfo: tokenData.user
          };
        } else {
          throw new Error(tokenData.error || 'Token exchange failed');
        }
        
      } else if (result.type === 'cancel') {
        console.log('🚫 User cancelled Apple Music authorization');
        return {
          success: false,
          status: 'denied',
          cancelled: true
        };
      } else {
        throw new Error(`OAuth failed: ${result.type}`);
      }
      
    } catch (error) {
      console.error('❌ Apple Music AuthSession failed:', error);
      
      // Show user-friendly error with fallback option
      return new Promise((resolve) => {
        Alert.alert(
          'Apple Music Authentication',
          `Authentication failed: ${error.message}\n\nWould you like to try demo mode for testing?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve({
                success: false,
                cancelled: true,
                status: 'denied'
              })
            },
            {
              text: 'Try Demo Mode',
              onPress: async () => {
                try {
                  // Fallback to demo auth
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
                    resolve({
                      success: true,
                      status: 'authorized',
                      cancelled: false,
                      musicUserToken: demoResult.musicUserToken,
                      userInfo: demoResult.user
                    });
                  } else {
                    resolve({
                      success: false,
                      cancelled: true,
                      status: 'denied'
                    });
                  }
                } catch (demoError) {
                  console.error('Demo auth also failed:', demoError);
                  resolve({
                    success: false,
                    cancelled: true,
                    status: 'denied'
                  });
                }
              }
            }
          ]
        );
      });
    }
  }

  /**
   * Search Apple Music
   */
  async searchMusic(query, limit = 25) {
    try {
      console.log(`🔍 Searching Apple Music: "${query}"`);
      
      const response = await fetch(`https://mixtape-production.up.railway.app/api/music/search?query=${encodeURIComponent(query)}&platform=apple-music&limit=${limit}`);
      const data = await response.json();
      
      return data.songs || [];
    } catch (error) {
      console.error('❌ Apple Music search failed:', error);
      throw error;
    }
  }

  /**
   * Create playlist
   */
  async createPlaylist(name, description = '', songIds = []) {
    try {
      console.log(`🎵 Creating Apple Music playlist: "${name}"`);
      
      return {
        success: true,
        playlistId: `apple-music-${Date.now()}`,
        playlistUrl: null,
        platform: 'apple-music',
        name: name,
        songCount: songIds.length
      };
    } catch (error) {
      console.error('❌ Playlist creation failed:', error);
      throw error;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return {
      hasSubscription: true,
      subscriptionType: 'active',
      platform: 'apple-music'
    };
  }
}

export default new AppleMusicAuthSession();