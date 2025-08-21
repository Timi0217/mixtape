import ExpoMusickit from '../modules/expo-musickit/src/index';

class NativeMusicKitService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the service by checking authorization status
   */
  async initialize() {
    try {
      console.log('🎵 Initializing Native MusicKit service...');
      
      const status = await ExpoMusickit.getAuthorizationStatus();
      console.log('🔐 Current authorization status:', status);
      
      this.isInitialized = true;
      return status;
    } catch (error) {
      console.error('❌ Failed to initialize Native MusicKit:', error);
      throw error;
    }
  }

  /**
   * Request authorization for Apple Music access
   */
  async requestAuthorization() {
    try {
      console.log('🍎 Requesting Apple Music authorization...');
      
      const result = await ExpoMusickit.requestAuthorization();
      console.log('✅ Authorization result:', result);
      
      return {
        success: result.authorized,
        status: result.status,
        cancelled: !result.authorized && result.status === 'denied'
      };
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      return {
        success: false,
        error: error.message,
        cancelled: false
      };
    }
  }

  /**
   * Check if user is ready to use Apple Music features
   */
  async isReady() {
    try {
      return await ExpoMusickit.isReady();
    } catch (error) {
      console.error('❌ Failed to check ready status:', error);
      return false;
    }
  }

  /**
   * Search for music in Apple Music catalog
   */
  async searchMusic(query, limit = 25) {
    try {
      console.log(`🔍 Searching Apple Music for: "${query}"`);
      
      const result = await ExpoMusickit.searchMusic(query, limit);
      console.log(`✅ Found ${result.songs.length} songs`);
      
      return result.songs.map(song => ({
        id: `apple-music:${song.id}`,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        imageUrl: song.artwork,
        previewUrl: null, // Apple Music doesn't provide preview URLs via MusicKit
        platform: 'apple-music',
        platformId: song.id,
        isrc: song.isrc,
        url: song.url
      }));
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Create a playlist in user's Apple Music library
   */
  async createPlaylist(name, description = '', songIds = []) {
    try {
      console.log(`🎵 Creating Apple Music playlist: "${name}" with ${songIds.length} songs`);
      
      // Extract Apple Music IDs from platform-specific IDs
      const appleMusicIds = songIds
        .filter(id => id.startsWith('apple-music:'))
        .map(id => id.replace('apple-music:', ''));
      
      const result = await ExpoMusickit.createPlaylist(name, description, appleMusicIds);
      console.log('✅ Playlist created:', result);
      
      return {
        success: result.success,
        playlistId: result.id,
        playlistUrl: null, // MusicKit doesn't provide direct URLs
        platform: 'apple-music',
        name: result.name,
        songCount: result.songCount
      };
    } catch (error) {
      console.error('❌ Playlist creation failed:', error);
      throw error;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
      const user = await ExpoMusickit.getCurrentUser();
      console.log('👤 Current user:', user);
      
      return {
        hasSubscription: user.hasSubscription,
        subscriptionType: user.subscriptionType,
        platform: 'apple-music'
      };
    } catch (error) {
      console.error('❌ Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Get user token for backend communication
   */
  async getUserToken() {
    try {
      const tokenResult = await ExpoMusickit.getUserToken();
      return tokenResult.userToken;
    } catch (error) {
      console.error('❌ Failed to get user token:', error);
      throw error;
    }
  }

  /**
   * Complete authentication flow
   */
  async authenticateUser() {
    try {
      // First request authorization
      const authResult = await this.requestAuthorization();
      
      if (!authResult.success) {
        return authResult;
      }

      // Get user token for backend
      const userToken = await this.getUserToken();
      
      // Get user info
      const userInfo = await this.getCurrentUser();
      
      return {
        success: true,
        userToken,
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