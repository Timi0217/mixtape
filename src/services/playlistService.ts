import { prisma } from '../config/database';
import axios from 'axios';

interface PlaylistCreationResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  error?: string;
  platform: string;
  userId: string;
}

export class PlaylistService {

  /**
   * Create playlists for all group members based on their preferred platform
   */
  static async createPlaylistsForCompletedRound(roundId: string): Promise<PlaylistCreationResult[]> {
    console.log(`🎵 Creating playlists for completed round: ${roundId}`);

    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    musicAccounts: true,
                    musicPreferences: true,
                  },
                },
              },
            },
          },
        },
        submissions: {
          include: {
            user: true,
            song: true,
          },
        },
      },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    const results: PlaylistCreationResult[] = [];
    const playlistName = this.generatePlaylistName(round.group.name, round.date);

    // Group members by their preferred platform
    const membersByPlatform = this.groupMembersByPlatform(round.group.members);

    // Create playlists for each platform
    for (const [platform, members] of Object.entries(membersByPlatform)) {
      console.log(`📱 Creating ${platform} playlist for ${members.length} members`);

      try {
        // For now, just use the songs as submitted (no cross-platform matching)
        const songs = round.submissions.map(sub => ({
          id: sub.song.spotifyId || sub.song.appleMusicId,
          title: sub.song.title,
          artist: sub.song.artist,
          platform: sub.song.platform,
          originalSubmission: sub,
        })).filter(song => song.id); // Only include songs with valid IDs

        if (songs.length === 0) {
          console.log(`⚠️ No valid songs found for ${platform}`);
          continue;
        }

        // Create playlist for each member on this platform
        for (const member of members) {
          try {
            const result = await this.createPlatformPlaylist(
              member.user,
              platform,
              playlistName,
              songs,
              round
            );
            results.push(result);
          } catch (error) {
            console.error(`❌ Failed to create playlist for user ${member.user.id} on ${platform}:`, error);
            results.push({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              platform,
              userId: member.user.id,
            });
          }
        }
      } catch (error) {
        console.error(`❌ Failed to process ${platform} playlists:`, error);
        // Add failed results for all members of this platform
        members.forEach(member => {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Platform processing failed',
            platform,
            userId: member.user.id,
          });
        });
      }
    }

    console.log(`✅ Playlist creation completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  /**
   * Group members by their preferred music platform
   */
  private static groupMembersByPlatform(members: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const member of members) {
      // Determine user's preferred platform
      let platform = 'spotify'; // Default to Spotify

      // Check user preferences
      if (member.user.musicPreferences?.preferredPlatform) {
        platform = member.user.musicPreferences.preferredPlatform;
      } else if (member.user.musicAccounts?.length > 0) {
        // Use the platform they have an active account for
        platform = member.user.musicAccounts[0].platform;
      }

      if (!grouped[platform]) {
        grouped[platform] = [];
      }
      grouped[platform].push(member);
    }

    return grouped;
  }

  /**
   * Create a playlist on a specific platform for a user
   */
  private static async createPlatformPlaylist(
    user: any,
    platform: string,
    playlistName: string,
    songs: any[],
    round: any
  ): Promise<PlaylistCreationResult> {
    console.log(`🎶 Creating ${platform} playlist "${playlistName}" for user ${user.displayName}`);

    // Find user's music account for this platform
    const musicAccount = user.musicAccounts?.find((account: any) => account.platform === platform);
    
    if (!musicAccount) {
      throw new Error(`User ${user.id} has no ${platform} account connected`);
    }

    // Check if token is still valid
    if (musicAccount.expiresAt && new Date() > musicAccount.expiresAt) {
      throw new Error(`${platform} token expired for user ${user.id}`);
    }

    try {
      let playlistResult;

      if (platform === 'spotify') {
        playlistResult = await this.createSpotifyPlaylist(musicAccount, playlistName, songs, round);
      } else if (platform === 'apple-music') {
        playlistResult = await this.createAppleMusicPlaylist(musicAccount, playlistName, songs, round);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Store the playlist in our database
      await prisma.playlist.create({
        data: {
          userId: user.id,
          roundId: round.id,
          platform: platform,
          platformPlaylistId: playlistResult.playlistId,
          name: playlistName,
          description: `Mixtape playlist for ${round.group.name} - ${round.date.toDateString()}`,
          trackCount: songs.length,
          isPublic: false,
        },
      });

      return {
        success: true,
        playlistId: playlistResult.playlistId,
        playlistUrl: playlistResult.playlistUrl,
        platform,
        userId: user.id,
      };

    } catch (error) {
      console.error(`❌ Error creating ${platform} playlist:`, error);
      throw error;
    }
  }

  /**
   * Create a Spotify playlist
   */
  private static async createSpotifyPlaylist(musicAccount: any, name: string, songs: any[], round: any) {
    const spotifyApi = 'https://api.spotify.com/v1';
    
    // Get user's Spotify profile to get user ID
    const profileResponse = await axios.get(`${spotifyApi}/me`, {
      headers: { Authorization: `Bearer ${musicAccount.accessToken}` },
    });

    const userId = profileResponse.data.id;

    // Create playlist
    const playlistResponse = await axios.post(`${spotifyApi}/users/${userId}/playlists`, {
      name,
      description: `Mixtape playlist for ${round.group.name} - ${round.date.toDateString()}`,
      public: false,
    }, {
      headers: { 
        Authorization: `Bearer ${musicAccount.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const playlistId = playlistResponse.data.id;
    const playlistUrl = playlistResponse.data.external_urls.spotify;

    // Add tracks to playlist - only Spotify tracks
    const spotifyTracks = songs.filter(song => song.platform === 'spotify' && song.id);
    
    if (spotifyTracks.length > 0) {
      const trackUris = spotifyTracks.map(song => `spotify:track:${song.id}`);

      await axios.post(`${spotifyApi}/playlists/${playlistId}/tracks`, {
        uris: trackUris,
      }, {
        headers: { 
          Authorization: `Bearer ${musicAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    return { playlistId, playlistUrl };
  }

  /**
   * Create an Apple Music playlist
   */
  private static async createAppleMusicPlaylist(musicAccount: any, name: string, songs: any[], round: any) {
    // Apple Music playlist creation requires different approach
    console.log(`🍎 Apple Music playlist creation not yet implemented for: ${name}`);
    
    // TODO: Implement Apple Music playlist creation
    // Apple Music API requires different authentication and endpoints
    
    throw new Error('Apple Music playlist creation not yet implemented');
  }

  /**
   * Generate a playlist name for the round
   */
  private static generatePlaylistName(groupName: string, date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    return `${groupName} Mixtape - ${dateStr}`;
  }
}