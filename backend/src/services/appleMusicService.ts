import jwt from 'jsonwebtoken';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface AppleMusicToken {
  token: string;
  expiresAt: Date;
}

export interface AppleMusicUserToken {
  userToken: string;
  // Apple doesn't provide refresh tokens for music user tokens
}

class AppleMusicService {
  private developerToken: string | null = null;
  private developerTokenExpiresAt: Date | null = null;

  // Generate a developer token (server-to-server authentication)
  async getDeveloperToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.developerToken && this.developerTokenExpiresAt && this.developerTokenExpiresAt > new Date()) {
      return this.developerToken;
    }

    try {
      const keyId = process.env.APPLE_MUSIC_KEY_ID;
      const teamId = process.env.APPLE_MUSIC_TEAM_ID;
      const privateKeyPath = process.env.APPLE_MUSIC_PRIVATE_KEY_PATH;

      if (!keyId || !teamId) {
        throw new Error('Apple Music configuration is incomplete. Please set APPLE_MUSIC_KEY_ID and APPLE_MUSIC_TEAM_ID environment variables.');
      }
      
      if (!process.env.APPLE_MUSIC_PRIVATE_KEY && !process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64 && !privateKeyPath) {
        throw new Error('Apple Music private key not found. Please set APPLE_MUSIC_PRIVATE_KEY, APPLE_MUSIC_PRIVATE_KEY_BASE64, or APPLE_MUSIC_PRIVATE_KEY_PATH.');
      }

      // Try to get private key from environment variable first, then base64, then fallback to file
      let privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY;
      let keySource = 'unknown';
      
      console.log('🔍 Apple Music Private Key Debug:');
      console.log('- Raw env var exists:', !!process.env.APPLE_MUSIC_PRIVATE_KEY);
      console.log('- Base64 env var exists:', !!process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64);
      
      if (privateKey) {
        keySource = 'environment variable (direct)';
        console.log('- Using direct env var, length:', privateKey.length);
        console.log('- Direct env var preview:', privateKey.substring(0, 200) + '...');
      } else if (process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64) {
        keySource = 'environment variable (base64)';
        console.log('- Using base64 env var, decoding...');
        // Remove any whitespace, line breaks, or spaces from base64 string
        const cleanBase64 = process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64.replace(/\s+/g, '');
        console.log('- Original base64 length:', process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64.length);
        console.log('- Cleaned base64 length:', cleanBase64.length);
        privateKey = Buffer.from(cleanBase64, 'base64').toString('utf8');
        console.log('- Decoded length:', privateKey.length);
        console.log('- Decoded preview:', privateKey.substring(0, 200) + '...');
      }
      
      console.log('- Key source:', keySource);
      
      if (!privateKey) {
        // Fallback to reading from file (for local development)
        privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
        console.log('- Read from file, length:', privateKey.length);
      } else {
        console.log('- Original env var length:', privateKey.length);
        console.log('- Contains newlines before processing:', privateKey.includes('\n'));
        console.log('- Contains escaped newlines:', privateKey.includes('\\n'));
        console.log('- First 100 chars:', privateKey.substring(0, 100));
        
        // Environment variable might have escaped newlines, fix them
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('- After escape replacement, contains newlines:', privateKey.includes('\n'));
        
        // If it's still one line, try to format it properly
        if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          console.log('- Formatting single-line key...');
          // Split the key into proper format
          privateKey = privateKey
            .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
            .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
            .replace(/(.{64})/g, '$1\n') // Add newlines every 64 chars for the key data
            .replace(/\n\n/g, '\n') // Remove double newlines
            .trim();
          console.log('- After formatting, length:', privateKey.length);
        }
      }
      
      console.log('- Final key format check:');
      console.log('- Starts with BEGIN:', privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));
      console.log('- Ends with END:', privateKey.endsWith('-----END PRIVATE KEY-----'));
      console.log('- Has newlines:', privateKey.includes('\n'));
      console.log('- Line count:', privateKey.split('\n').length);

      // Create JWT payload (Apple Music requires specific claims)
      const payload = {
        iss: teamId, // Team ID
        aud: 'appstoreconnect-v1', // Required audience for Apple Music API
        iat: Math.floor(Date.now() / 1000), // Issued at
        exp: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60), // Expires in 6 months
      };

      // Create JWT header
      const header = {
        alg: 'ES256',
        kid: keyId,
      };

      console.log('🔐 JWT Generation Debug:');
      console.log('- Payload:', JSON.stringify(payload, null, 2));
      console.log('- Header:', JSON.stringify(header, null, 2));
      console.log('- Algorithm: ES256');
      console.log('- Key ID:', keyId);
      console.log('- Team ID:', teamId);

      // Generate the developer token
      console.log('- Attempting JWT sign...');
      const token = jwt.sign(payload, privateKey, { 
        algorithm: 'ES256',
        header: header 
      });
      console.log('✅ JWT sign successful, token length:', token.length);

      // Cache the token
      this.developerToken = token;
      this.developerTokenExpiresAt = new Date(payload.exp * 1000);

      return token;
    } catch (error) {
      console.error('Failed to generate Apple Music developer token:', error);
      console.error('Error details:', {
        keyId: process.env.APPLE_MUSIC_KEY_ID ? 'present' : 'missing',
        teamId: process.env.APPLE_MUSIC_TEAM_ID ? 'present' : 'missing',
        privateKeyEnvVar: process.env.APPLE_MUSIC_PRIVATE_KEY ? 'present' : 'missing',
        errorMessage: error.message,
        errorStack: error.stack
      });
      throw new Error(`Failed to generate Apple Music developer token: ${error.message}`);
    }
  }

  // Search for music using the Apple Music API
  async searchMusic(query: string, limit: number = 20): Promise<any[]> {
    try {
      const developerToken = await this.getDeveloperToken();

      const response = await axios.get('https://api.music.apple.com/v1/catalog/us/search', {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
        },
        params: {
          term: query,
          types: 'songs',
          limit,
        },
      });

      return response.data.results?.songs?.data || [];
    } catch (error) {
      console.error('Apple Music search error:', error);
      throw new Error('Apple Music search failed');
    }
  }

  // Get song details by Apple Music ID
  async getSong(songId: string): Promise<any> {
    try {
      const developerToken = await this.getDeveloperToken();

      const response = await axios.get(`https://api.music.apple.com/v1/catalog/us/songs/${songId}`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
        },
      });

      return response.data.data[0];
    } catch (error) {
      console.error('Apple Music get song error:', error);
      throw new Error('Failed to get Apple Music song details');
    }
  }

  // Create a playlist (requires user token)
  async createPlaylist(
    userToken: string,
    playlistData: {
      name: string;
      description?: string;
      songs: string[]; // Apple Music song IDs
    }
  ): Promise<any> {
    try {
      const developerToken = await this.getDeveloperToken();

      // Create the playlist
      const playlistResponse = await axios.post(
        'https://api.music.apple.com/v1/me/library/playlists',
        {
          attributes: {
            name: playlistData.name,
            description: playlistData.description || 'Created by Mixtape',
          },
          relationships: {
            tracks: {
              data: playlistData.songs.map(songId => ({
                id: songId,
                type: 'songs',
              })),
            },
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${developerToken}`,
            'Music-User-Token': userToken,
            'Content-Type': 'application/json',
          },
        }
      );

      return playlistResponse.data.data[0];
    } catch (error) {
      console.error('Apple Music create playlist error:', error);
      throw new Error('Failed to create Apple Music playlist');
    }
  }

  // Get user's library playlists (requires user token)
  async getUserPlaylists(userToken: string): Promise<any[]> {
    try {
      const developerToken = await this.getDeveloperToken();

      const response = await axios.get('https://api.music.apple.com/v1/me/library/playlists', {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken,
        },
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Apple Music get playlists error:', error);
      throw new Error('Failed to get Apple Music playlists');
    }
  }


  // Update playlist tracks (replace all tracks)
  async updatePlaylistTracks(userToken: string, playlistId: string, songIds: string[]): Promise<void> {
    try {
      const developerToken = await this.getDeveloperToken();

      // Apple Music doesn't have a direct "replace all tracks" API
      // For now, we'll just log a warning since this is complex to implement
      console.warn('Apple Music playlist track updating not yet implemented. Playlist ID:', playlistId);
      
      // TODO: Implement proper track replacement:
      // 1. Get current tracks in playlist
      // 2. Remove all current tracks
      // 3. Add new tracks
      // This requires multiple API calls and is complex
      
    } catch (error) {
      console.error('Apple Music update playlist tracks error:', error);
      throw new Error('Failed to update Apple Music playlist tracks');
    }
  }

  // Validate a user token
  async validateUserToken(userToken: string): Promise<boolean> {
    try {
      console.log('🔍 DEBUG: Token validation started');
      console.log('🔍 DEBUG: Token type check:', {
        length: userToken.length,
        startsWithDemo: userToken.startsWith('demo_apple_music_'),
        startsWithServer: userToken.startsWith('server_apple_music_'),
        startsWithSimulated: userToken.startsWith('simulated_'),
        preview: userToken.substring(0, 50) + '...'
      });
      
      // Allow demo tokens for development
      if (userToken.startsWith('demo_apple_music_') || 
          userToken.startsWith('server_apple_music_') ||
          userToken.startsWith('simulated_')) {
        console.log('🎭 Accepting development/demo token');
        return true;
      }

      console.log('🔍 DEBUG: Getting developer token for validation...');
      const developerToken = await this.getDeveloperToken();
      console.log('🔍 DEBUG: Developer token obtained, length:', developerToken.length);

      console.log('🔍 DEBUG: Making Apple Music API validation request...');
      const response = await axios.get('https://api.music.apple.com/v1/me/storefront', {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken,
        },
        timeout: 10000
      });

      console.log('🔍 DEBUG: Apple Music API response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      const isValid = response.status === 200;
      console.log('🔍 DEBUG: Token validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('🔍 DEBUG: Token validation error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      return false;
    }
  }

  // Format search results to match our standard format
  formatSearchResults(appleMusicSongs: any[]): any[] {
    return appleMusicSongs.map(song => ({
      id: `apple:${song.id}`,
      title: song.attributes.name,
      artist: song.attributes.artistName,
      album: song.attributes.albumName,
      duration: Math.floor(song.attributes.durationInMillis / 1000),
      imageUrl: song.attributes.artwork?.url?.replace('{w}', '300').replace('{h}', '300'),
      previewUrl: song.attributes.previews?.[0]?.url,
      platform: 'apple-music',
      platformId: song.id,
    }));
  }
}

export const appleMusicService = new AppleMusicService();