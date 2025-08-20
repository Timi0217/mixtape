import { Alert } from 'react-native';
import api from './api';
import musicKitService from './musicKitService';

class AppleUpgradeService {
  // Upgrade Apple ID account to Apple Music account
  async upgradeToAppleMusic() {
    try {
      console.log('🔄 Starting Apple ID to Apple Music upgrade...');
      
      // Step 1: Initialize MusicKit
      await musicKitService.initialize();
      
      // Step 2: Get Music User Token
      console.log('🍎 Getting Music User Token...');
      const result = await musicKitService.authenticateWithDirectURL();
      
      if (result.type !== 'success' || !result.url) {
        throw new Error('Failed to get Music User Token');
      }
      
      // Step 3: Extract token from URL
      const musicUserToken = musicKitService.extractTokenFromUrl(result.url);
      if (!musicUserToken) {
        throw new Error('Failed to extract Music User Token from callback');
      }
      
      console.log('✅ Music User Token obtained, upgrading account...');
      
      // Step 4: Call upgrade endpoint
      const response = await api.post('/oauth/apple-id/upgrade-to-music', {
        musicUserToken
      });
      
      if (response.data.success) {
        console.log('✅ Successfully upgraded to Apple Music account');
        return {
          success: true,
          message: response.data.message,
          user: response.data.user
        };
      } else {
        throw new Error(response.data.message || 'Upgrade failed');
      }
      
    } catch (error) {
      console.error('❌ Apple Music upgrade failed:', error);
      throw error;
    }
  }
  
  // Show upgrade prompt to user
  async promptUserForUpgrade() {
    return new Promise((resolve) => {
      Alert.alert(
        'Connect Apple Music',
        'To create playlists, you need to connect your Apple Music account. This will upgrade your current Apple account to include music access.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Connect Apple Music',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }
  
  // Complete upgrade flow with user interaction
  async completeUpgradeFlow() {
    try {
      // Ask user if they want to upgrade
      const shouldUpgrade = await this.promptUserForUpgrade();
      
      if (!shouldUpgrade) {
        return { success: false, cancelled: true };
      }
      
      // Perform the upgrade
      const result = await this.upgradeToAppleMusic();
      
      // Show success message
      Alert.alert(
        'Apple Music Connected!',
        'Your account has been upgraded to include Apple Music access. You can now create playlists.',
        [{ text: 'OK' }]
      );
      
      return result;
      
    } catch (error) {
      console.error('❌ Upgrade flow failed:', error);
      
      // Show error message with fallback
      Alert.alert(
        'Apple Music Setup',
        'Failed to connect Apple Music. You can still use Spotify to create playlists.',
        [{ text: 'OK' }]
      );
      
      throw error;
    }
  }
}

export default new AppleUpgradeService();