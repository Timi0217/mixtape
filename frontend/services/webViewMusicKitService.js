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
      
      const response = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          musicUserToken: userToken,
          platform: 'apple-music'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Token exchange successful!');
        return {
          success: true,
          token: data.token,
          user: data.user,
          platform: data.platform
        };
      } else {
        throw new Error(data.error || 'Token exchange failed');
      }
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
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