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

      if (!keyId || !teamId || !privateKeyPath) {
        throw new Error('Apple Music configuration is incomplete. Please set APPLE_MUSIC_KEY_ID, APPLE_MUSIC_TEAM_ID, and APPLE_MUSIC_PRIVATE_KEY_PATH environment variables.');
      }

      // Read the private key file
      const privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');

      // Create JWT payload
      const payload = {
        iss: teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60), // 6 months
      };

      // Create JWT header
      const header = {
        alg: 'ES256',
        kid: keyId,
      };

      // Generate the developer token
      const token = jwt.sign(payload, privateKey, { 
        algorithm: 'ES256',
        header: header 
      });

      // Cache the token
      this.developerToken = token;
      this.developerTokenExpiresAt = new Date(payload.exp * 1000);

      return token;
    } catch (error) {
      console.error('Failed to generate Apple Music developer token:', error);
      throw new Error('Failed to generate Apple Music developer token');
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
      const developerToken = await this.getDeveloperToken();

      const response = await axios.get('https://api.music.apple.com/v1/me/storefront', {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken,
        },
      });

      return response.status === 200;
    } catch (error) {
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