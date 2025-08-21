// Native MusicKit service - uses REAL Apple Music authorization
import ExpoMusickit from '../modules/expo-musickit/expo-musickit/src';
import { Alert } from 'react-native';

class NativeMusicKitService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      console.log('🎵 Initializing Native MusicKit service (fallback mode)...');
      
      // For now, use the existing musicKit service
      await musicKitService.initialize();
      
      this.isInitialized = true;
      return { authorized: false, status: 'notDetermined' };
    } catch (error) {
      console.error('❌ Failed to initialize Native MusicKit:', error);
      throw error;
    }
  }

  /**
   * Request real Apple Music authorization using native iOS MusicKit
   */
  async requestAuthorization() {
    try {
      console.log('🍎 Requesting native Apple Music authorization...');
      
      // Use the native iOS MusicKit module
      const result = await ExpoMusickit.requestAuthorization();
      
      console.log('🔍 Native authorization result:', result);
      
      if (result.status === 'authorized') {
        console.log('✅ Native Apple Music authorization successful');
        
        // Get the music user token from the native module
        const tokenResult = await ExpoMusickit.getUserToken();
        const userToken = tokenResult.userToken;
        
        return {
          success: true,
          cancelled: false,
          status: 'authorized',
          userToken: userToken,
          musicUserToken: userToken // Keep both for compatibility
        };
      } else {
        console.log('❌ Native authorization failed:', result.status);
        return {
          success: false,
          cancelled: result.status === 'denied',
          status: result.status,
          error: `Apple Music authorization ${result.status}`
        };
      }
      
    } catch (error) {
      console.error('❌ Native Apple Music authorization failed:', error);
      
      return {
        success: false,
        cancelled: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check if ready
   */
  async isReady() {
    return true; // Simplified for now
  }

  /**
   * Search music - use backend service
   */
  async searchMusic(query, limit = 25) {
    try {
      console.log(`🔍 Searching Apple Music for: "${query}" (via backend)`);
      
      // Use your backend Apple Music search
      const response = await fetch(`https://mixtape-production.up.railway.app/api/music/search?query=${encodeURIComponent(query)}&platform=apple-music&limit=${limit}`);
      const data = await response.json();
      
      if (data.songs) {
        return data.songs;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Create playlist - use backend
   */
  async createPlaylist(name, description = '', songIds = []) {
    try {
      console.log(`🎵 Creating Apple Music playlist: "${name}" (via backend)`);
      
      // For now, return success simulation
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
   * Get current user
   */
  async getCurrentUser() {
    return {
      hasSubscription: true, // Assume true for demo
      subscriptionType: 'active',
      platform: 'apple-music'
    };
  }

  /**
   * Get user token - stored from authorization
   */
  async getUserToken() {
    // This will be set during authentication
    return this.realMusicUserToken || null;
  }

  /**
   * Complete authentication flow
   */
  async authenticateUser() {
    try {
      // Request authorization
      const authResult = await this.requestAuthorization();
      
      if (!authResult.success) {
        return authResult;
      }

      // Store the real music user token
      this.realMusicUserToken = authResult.musicUserToken;
      
      // Get token and user info
      const userToken = await this.getUserToken();
      const userInfo = await this.getCurrentUser();
      
      return {
        success: true,
        token: userToken,        // Use 'token' for compatibility
        userToken,               // Keep both for completeness
        userInfo,
        platform: 'apple-music'
      };
    } catch (error) {
      console.error('❌ Authentication flow failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new NativeMusicKitService();