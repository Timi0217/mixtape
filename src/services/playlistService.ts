import axios from 'axios';
import { prisma } from '../config/database';
import { musicService } from './musicService';

export interface PlaylistCreationResult {
  platform: string;
  playlistId: string;
  playlistUrl: string;
  success: boolean;
  error?: string;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  platforms: string[];
  songs: string[]; // Song IDs from our database
  isPublic?: boolean;
}

class PlaylistService {
  async createCrossPlatformPlaylist(
    userId: string,
    request: CreatePlaylistRequest
  ): Promise<{ results: PlaylistCreationResult[]; playlistId: string }> {
    const songs = await prisma.song.findMany({
      where: {
        id: { in: request.songs }
      }
    });

    const playlist = await prisma.playlist.create({
      data: {
        roundId: '', // This would be set if creating from a round
        status: 'pending',
        platformPlaylistIds: {},
      }
    });

    const creationPromises = request.platforms.map(platform =>
      this.createPlaylistOnPlatform(userId, platform, request, songs)
    );

    const results = await Promise.allSettled(creationPromises);
    const playlistResults: PlaylistCreationResult[] = [];
    const platformPlaylistIds: Record<string, string> = {};

    results.forEach((result, index) => {
      const platform = request.platforms[index];
      if (result.status === 'fulfilled' && result.value.success) {
        playlistResults.push(result.value);
        platformPlaylistIds[platform] = result.value.playlistId;
      } else {
        playlistResults.push({
          platform,
          playlistId: '',
          playlistUrl: '',
          success: false,
          error: result.status === 'rejected' ? result.reason.message : 'Unknown error'
        });
      }
    });

    await prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        status: playlistResults.some(r => r.success) ? 'completed' : 'failed',
        platformPlaylistIds,
      }
    });

    // Create playlist tracks
    const trackPromises = songs.map((song, index) =>
      prisma.playlistTrack.create({
        data: {
          playlistId: playlist.id,
          songId: song.id,
          submittedByUserId: userId,
          orderIndex: index,
        }
      })
    );
    await Promise.all(trackPromises);

    return {
      results: playlistResults,
      playlistId: playlist.id,
    };
  }

  private async createPlaylistOnPlatform(
    userId: string,
    platform: string,
    request: CreatePlaylistRequest,
    songs: any[]
  ): Promise<PlaylistCreationResult> {
    try {
      switch (platform) {
        case 'spotify':
          return await this.createSpotifyPlaylist(userId, request, songs);
        case 'apple-music':
          return await this.createAppleMusicPlaylist(userId, request, songs);
        case 'youtube-music':
          return await this.createYouTubeMusicPlaylist(userId, request, songs);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`Failed to create playlist on ${platform}:`, error);
      return {
        platform,
        playlistId: '',
        playlistUrl: '',
        success: false,
        error: error.message,
      };
    }
  }

  private async createSpotifyPlaylist(
    userId: string,
    request: CreatePlaylistRequest,
    songs: any[]
  ): Promise<PlaylistCreationResult> {
    const userAccount = await this.getUserMusicAccount(userId, 'spotify');
    
    // Create playlist
    const playlistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${userAccount.spotifyUserId}/playlists`,
      {
        name: request.name,
        description: request.description || 'Created by Mixtape',
        public: request.isPublic || false,
      },
      {
        headers: {
          'Authorization': `Bearer ${userAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const playlist = playlistResponse.data;

    // Add tracks
    const spotifyTrackUris = songs
      .filter(song => song.platformIds.spotify)
      .map(song => `spotify:track:${song.platformIds.spotify}`);

    if (spotifyTrackUris.length > 0) {
      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        { uris: spotifyTrackUris },
        {
          headers: {
            'Authorization': `Bearer ${userAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return {
      platform: 'spotify',
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls.spotify,
      success: true,
    };
  }

  private async createAppleMusicPlaylist(
    userId: string,
    request: CreatePlaylistRequest,
    songs: any[]
  ): Promise<PlaylistCreationResult> {
    try {
      const userAccount = await this.getUserMusicAccount(userId, 'apple-music');
      const { appleMusicService } = await import('./appleMusicService');

      // Get Apple Music song IDs
      const appleMusicSongIds = songs
        .filter(song => song.platformIds['apple-music'])
        .map(song => song.platformIds['apple-music']);

      // Create playlist using Apple Music service
      const playlist = await appleMusicService.createPlaylist(
        userAccount.accessToken, // This is the user token
        {
          name: request.name,
          description: request.description,
          songs: appleMusicSongIds,
        }
      );

      return {
        platform: 'apple-music',
        playlistId: playlist.id,
        playlistUrl: `https://music.apple.com/library/playlist/${playlist.id}`,
        success: true,
      };
    } catch (error) {
      console.error('Apple Music playlist creation error:', error);
      return {
        platform: 'apple-music',
        playlistId: '',
        playlistUrl: '',
        success: false,
        error: error.message,
      };
    }
  }

  private async createYouTubeMusicPlaylist(
    userId: string,
    request: CreatePlaylistRequest,
    songs: any[]
  ): Promise<PlaylistCreationResult> {
    const userAccount = await this.getUserMusicAccount(userId, 'youtube-music');

    // Create playlist
    const playlistResponse = await axios.post(
      'https://www.googleapis.com/youtube/v3/playlists',
      {
        snippet: {
          title: request.name,
          description: request.description || 'Created by Mixtape',
        },
        status: {
          privacyStatus: request.isPublic ? 'public' : 'private',
        },
      },
      {
        params: { part: 'snippet,status' },
        headers: {
          'Authorization': `Bearer ${userAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const playlist = playlistResponse.data;

    // Add videos to playlist
    const youtubeVideoIds = songs
      .filter(song => song.platformIds['youtube-music'])
      .map(song => song.platformIds['youtube-music']);

    for (const videoId of youtubeVideoIds) {
      await axios.post(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        {
          snippet: {
            playlistId: playlist.id,
            resourceId: {
              kind: 'youtube#video',
              videoId: videoId,
            },
          },
        },
        {
          params: { part: 'snippet' },
          headers: {
            'Authorization': `Bearer ${userAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return {
      platform: 'youtube-music',
      playlistId: playlist.id,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`,
      success: true,
    };
  }

  private async getUserMusicAccount(userId: string, platform: string) {
    const account = await prisma.userMusicAccount.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    if (!account) {
      throw new Error(`No ${platform} account connected for user`);
    }

    if (account.expiresAt && account.expiresAt < new Date()) {
      if (!account.refreshToken) {
        throw new Error(`${platform} token expired and no refresh token available`);
      }

      // Refresh token logic would go here
      throw new Error(`${platform} token expired - refresh not implemented`);
    }

    return account;
  }

  async getPlaylistById(playlistId: string) {
    return prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        tracks: {
          include: {
            song: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async getUserPlaylists(userId: string) {
    return prisma.playlist.findMany({
      where: {
        tracks: {
          some: {
            submittedByUserId: userId,
          },
        },
      },
      include: {
        tracks: {
          include: {
            song: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });
  }
}

export const playlistService = new PlaylistService();