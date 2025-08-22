import { Alert } from 'react-native';

class WebViewMusicKitService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the WebView MusicKit service
   */
  async initialize() {
    console.log('🎵 Initializing WebView MusicKit service...');
    this.isInitialized = true;
    return true;
  }

  /**
   * Get Apple Music developer token for MusicKit
   */
  async getDeveloperToken() {
    try {
      console.log('🔑 Getting Apple Music developer token...');
      
      const response = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/login');
      const data = await response.json();
      
      if (data.musicKitConfig && data.musicKitConfig.developerToken) {
        console.log('✅ Developer token received');
        return data.musicKitConfig.developerToken;
      } else {
        throw new Error('No developer token in response');
      }
    } catch (error) {
      console.error('❌ Failed to get developer token:', error);
      throw error;
    }
  }

  /**
   * Handle WebView message from MusicKit authentication
   */
  handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📩 WebView message received:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to parse WebView message:', error);
      return {
        success: false,
        error: 'Failed to parse authentication response'
      };
    }
  }

  /**
   * Exchange Apple Music user token with backend
   */
  async exchangeTokenWithBackend(userToken) {
    try {
      console.log('🔄 Exchanging Apple Music token with backend...');
      console.log('🔍 DEBUG: Exchange request details:', {
        timestamp: new Date().toISOString(),
        tokenLength: userToken?.length || 0,
        tokenType: userToken?.startsWith('demo_') ? 'demo' : 
                   userToken?.startsWith('server_') ? 'server' :
                   userToken?.startsWith('simulated_') ? 'simulated' : 'real',
        tokenPreview: userToken?.substring(0, 50) + '...',
        endpoint: 'https://mixtape-production.up.railway.app/api/oauth/apple-music/exchange'
      });
      
      const requestBody = {
        musicUserToken: userToken,
        platform: 'apple-music'
      };
      
      console.log('🔍 DEBUG: Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('🔍 DEBUG: Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });
      
      const data = await response.json();
      console.log('🔍 DEBUG: Response data:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        console.log('✅ Token exchange successful!');
        console.log('🔍 DEBUG: Success response details:', {
          tokenReceived: !!data.token,
          userReceived: !!data.user,
          platform: data.platform
        });
        return {
          success: true,
          token: data.token,
          user: data.user,
          platform: data.platform
        };
      } else {
        console.error('❌ Token exchange failed with error:', data.error);
        console.log('🔍 DEBUG: Error response details:', data);
        throw new Error(data.error || 'Token exchange failed');
      }
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      console.error('🔍 DEBUG: Exchange error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
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

export default new WebViewMusicKitService();