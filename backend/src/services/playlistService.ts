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
        // Extract songs and attempt cross-platform matching if needed
        const originalSongs = round.submissions.map(sub => ({
          id: sub.song.id,
          title: sub.song.title,
          artist: sub.song.artist,
          album: sub.song.album,
          duration: sub.song.duration,
          imageUrl: sub.song.imageUrl,
          platformIds: sub.song.platformIds as Record<string, string>,
          originalSubmission: sub,
        }));

        const songs = [];
        
        for (const song of originalSongs) {
          const platformId = song.platformIds[platform];
          
          if (platformId) {
            // Song already exists on this platform
            songs.push({
              id: platformId,
              title: song.title,
              artist: song.artist,
              album: song.album,
              duration: song.duration,
              imageUrl: song.imageUrl,
              platform: platform,
              originalSubmission: song.originalSubmission,
              allPlatformIds: song.platformIds,
              confidence: 1.0, // Perfect match since it's the same song
            });
          } else {
            // Try to find the song on this platform using cross-platform matching
            console.log(`🔍 Song "${song.title}" not available on ${platform}, attempting cross-platform match...`);
            
            try {
              const { musicService } = await import('./musicService');
              const matchResults = await musicService.matchSongAcrossPlatforms(
                [{ title: song.title, artist: song.artist, album: song.album }],
                platform
              );
              
              if (matchResults[0]?.bestMatch && matchResults[0].confidence > 0.7) {
                const bestMatch = matchResults[0].bestMatch;
                console.log(`✅ Found cross-platform match with confidence ${matchResults[0].confidence.toFixed(2)}`);
                
                songs.push({
                  id: bestMatch.platformId,
                  title: bestMatch.title,
                  artist: bestMatch.artist,
                  album: bestMatch.album,
                  duration: bestMatch.duration,
                  imageUrl: bestMatch.imageUrl || song.imageUrl,
                  platform: platform,
                  originalSubmission: song.originalSubmission,
                  allPlatformIds: { ...song.platformIds, [platform]: bestMatch.platformId },
                  confidence: matchResults[0].confidence,
                  isCrossPlatformMatch: true,
                });
              } else {
                console.log(`❌ No suitable cross-platform match found for "${song.title}"`);
              }
            } catch (matchError) {
              console.error(`Failed to find cross-platform match for "${song.title}":`, matchError);
            }
          }
        }

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

    // Ensure token is valid, refreshing if necessary
    const { musicService } = await import('./musicService');
    const tokenIsValid = await musicService.ensureValidToken(user.id, platform);
    if (!tokenIsValid) {
      throw new Error(`Unable to obtain valid ${platform} token for user ${user.id}`);
    }

    // Get the fresh token after potential refresh
    const freshToken = await musicService.getValidUserToken(user.id, platform);
    if (!freshToken) {
      throw new Error(`No valid ${platform} token available for user ${user.id}`);
    }

    try {
      let playlistResult;

      if (platform === 'spotify') {
        playlistResult = await this.createSpotifyPlaylist(freshToken, playlistName, songs, round);
      } else if (platform === 'apple-music') {
        playlistResult = await this.createAppleMusicPlaylist(freshToken, playlistName, songs, round);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Note: We don't store individual user playlists in the database yet
      // The current schema is designed for group-wide playlist metadata
      // Individual platform playlists are created but not tracked per-user

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
  private static async createSpotifyPlaylist(accessToken: string, name: string, songs: any[], round: any) {
    const spotifyApi = 'https://api.spotify.com/v1';
    
    // Get user's Spotify profile to get user ID
    const profileResponse = await axios.get(`${spotifyApi}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userId = profileResponse.data.id;

    // Create playlist
    const playlistResponse = await axios.post(`${spotifyApi}/users/${userId}/playlists`, {
      name,
      description: `Mixtape playlist for ${round.group.name} - ${round.date.toDateString()}`,
      public: false,
    }, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const playlistId = playlistResponse.data.id;
    const playlistUrl = playlistResponse.data.external_urls.spotify;

    // Add tracks to playlist - extract Spotify IDs from platformIds
    const spotifyTracks = songs.filter(song => {
      const spotifyId = song.allPlatformIds?.['spotify'] || (song.platform === 'spotify' ? song.id : null);
      return spotifyId;
    }).map(song => {
      const spotifyId = song.allPlatformIds?.['spotify'] || song.id;
      return { ...song, id: spotifyId };
    });
    
    if (spotifyTracks.length > 0) {
      const trackUris = spotifyTracks.map(song => `spotify:track:${song.id}`);

      await axios.post(`${spotifyApi}/playlists/${playlistId}/tracks`, {
        uris: trackUris,
      }, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    return { playlistId, playlistUrl };
  }

  /**
   * Create an Apple Music playlist
   */
  private static async createAppleMusicPlaylist(accessToken: string, name: string, songs: any[], round: any) {
    console.log(`🍎 Creating Apple Music playlist "${name}"`);
    
    try {
      const { appleMusicService } = await import('./appleMusicService');
      
      // Extract Apple Music song IDs
      const appleMusicSongs = songs.filter(song => {
        const appleMusicId = song.allPlatformIds?.['apple-music'] || (song.platform === 'apple-music' ? song.id : null);
        return appleMusicId;
      }).map(song => {
        const appleMusicId = song.allPlatformIds?.['apple-music'] || song.id;
        return appleMusicId;
      });
      
      if (appleMusicSongs.length === 0) {
        throw new Error('No Apple Music tracks found for playlist');
      }
      
      // Create playlist using Apple Music service
      const playlist = await appleMusicService.createPlaylist(accessToken, {
        name,
        description: `Mixtape playlist for ${round.group.name} - ${round.date.toDateString()}`,
        songs: appleMusicSongs,
      });
      
      return {
        playlistId: playlist.id,
        playlistUrl: `https://music.apple.com/playlist/${playlist.id}`,
      };
    } catch (error) {
      console.error('Apple Music playlist creation error:', error);
      throw error;
    }
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
    return `${groupName.toLowerCase()} mixtape - ${dateStr}`;
  }
}