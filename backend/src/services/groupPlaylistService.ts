import { prisma } from '../config/database';
import axios from 'axios';

interface GroupPlaylistManager {
  groupId: string;
  platform: 'spotify' | 'apple-music';
  playlistId?: string;
  playlistUrl?: string;
}

export class GroupPlaylistService {

  /**
   * Create or get existing group playlists for all platforms used by group members
   * Now with proper race condition handling and atomic operations
   */
  static async ensureGroupPlaylists(groupId: string, requestingUserId?: string): Promise<GroupPlaylistManager[]> {
    console.log(`🎵 Ensuring group playlists exist for group: ${groupId}`);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
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
        groupPlaylists: true,
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    let platformsToCreate: string[] = [];
    
    // Create playlists for all platforms used by group members
    // Admin can create them, but playlists should exist for all platforms in the group
    platformsToCreate = this.getPlatformsUsedByGroup(group.members);
    console.log(`📱 Creating playlists for all group platforms: ${platformsToCreate.join(', ')}`);
    
    if (requestingUserId) {
      console.log(`👑 Admin ${requestingUserId} creating playlists for group`);
    }

    const groupPlaylists: GroupPlaylistManager[] = [];

    // Process platforms sequentially to avoid race conditions
    for (const platform of platformsToCreate) {
      try {
        let groupPlaylist = group.groupPlaylists.find(gp => gp.platform === platform && gp.isActive);

        if (!groupPlaylist) {
          // Use atomic operation to prevent duplicate playlist creation
          try {
            // Try to create playlist atomically
            groupPlaylist = await this.createPlatformPlaylistAtomic(
              group,
              platform,
              requestingUserId
            );
          } catch (error) {
            // If creation fails due to duplicate, try to fetch existing
            if (error.code === 'P2002' || error.message.includes('duplicate') || error.message.includes('unique')) {
              console.log(`🔄 Playlist already exists for ${platform}, fetching existing...`);
              const existingPlaylist = await prisma.groupPlaylist.findFirst({
                where: {
                  groupId: group.id,
                  platform: platform,
                  isActive: true,
                },
              });
              if (existingPlaylist) {
                groupPlaylist = existingPlaylist;
              } else {
                console.error(`❌ Failed to create or find ${platform} playlist:`, error);
                continue;
              }
            } else {
              console.error(`❌ Failed to create ${platform} playlist:`, error);
              continue;
            }
          }
        }

        // Validate playlist still exists on the platform
        const isValid = await this.validatePlaylistExists(groupPlaylist);
        if (!isValid) {
          console.log(`⚠️ Playlist ${groupPlaylist.platformPlaylistId} no longer exists on ${platform}, recreating...`);
          try {
            // Mark old playlist as inactive
            await prisma.groupPlaylist.update({
              where: { id: groupPlaylist.id },
              data: { isActive: false },
            });
            
            // Create new playlist
            groupPlaylist = await this.createPlatformPlaylistAtomic(
              group,
              platform
            );
          } catch (recreateError) {
            console.error(`❌ Failed to recreate ${platform} playlist:`, recreateError);
            continue;
          }
        }

        groupPlaylists.push({
          groupId,
          platform: platform as 'spotify' | 'apple-music',
          playlistId: groupPlaylist.platformPlaylistId,
          playlistUrl: groupPlaylist.playlistUrl || undefined,
        });
      } catch (platformError) {
        console.error(`❌ Error processing ${platform} playlist:`, platformError);
        // Continue with other platforms even if one fails
        continue;
      }
    }

    return groupPlaylists;
  }

  /**
   * Update group playlists with daily submissions (clear old, add new)
   */
  static async updateGroupPlaylistsForRound(roundId: string): Promise<void> {
    console.log(`🔄 Updating group playlists for round: ${roundId}`);

    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            groupPlaylists: {
              where: { isActive: true },
            },
            members: {
              include: {
                user: {
                  include: {
                    musicAccounts: true,
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

    if (round.submissions.length === 0) {
      console.log('⚠️ No submissions for this round, clearing playlists');
      // Clear all group playlists since no songs were submitted
      for (const groupPlaylist of round.group.groupPlaylists) {
        await this.clearPlaylist(groupPlaylist, round.group);
      }
      return;
    }

    // Update each platform's group playlist
    for (const groupPlaylist of round.group.groupPlaylists) {
      try {
        await this.updatePlatformPlaylist(groupPlaylist, round.submissions, round.group);
        
        // Update last updated timestamp
        await prisma.groupPlaylist.update({
          where: { id: groupPlaylist.id },
          data: { lastUpdated: new Date() },
        });
        
      } catch (error) {
        console.error(`❌ Failed to update ${groupPlaylist.platform} playlist:`, error);
      }
    }

    console.log(`✅ Group playlists updated for round ${roundId}`);
  }

  /**
   * Update a specific platform playlist with new songs
   * Enhanced with better error handling and retry logic
   */
  private static async updatePlatformPlaylist(
    groupPlaylist: any,
    submissions: any[],
    group: any
  ): Promise<void> {
    console.log(`🎶 Updating ${groupPlaylist.platform} playlist: ${groupPlaylist.playlistName}`);

    // Find a user who can manage this playlist (admin first, then any member with the platform)
    const playlistManager = await this.findPlaylistManager(group, groupPlaylist.platform);
    if (!playlistManager) {
      throw new Error(`No user found to manage ${groupPlaylist.platform} playlist`);
    }

    // Get fresh token for the playlist manager with retry logic
    const { musicService } = await import('./musicService');
    let freshToken: string | null = null;
    let tokenAttempts = 0;
    const maxTokenAttempts = 3;

    while (!freshToken && tokenAttempts < maxTokenAttempts) {
      try {
        const tokenIsValid = await musicService.ensureValidToken(playlistManager.id, groupPlaylist.platform);
        if (!tokenIsValid) {
          console.log(`⚠️ Token validation failed for ${groupPlaylist.platform}, attempt ${tokenAttempts + 1}`);
          tokenAttempts++;
          if (tokenAttempts < maxTokenAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * tokenAttempts)); // Exponential backoff
            continue;
          }
          throw new Error(`Unable to obtain valid ${groupPlaylist.platform} token after ${maxTokenAttempts} attempts`);
        }

        freshToken = await musicService.getValidUserToken(playlistManager.id, groupPlaylist.platform);
        if (!freshToken) {
          console.log(`⚠️ No fresh token available for ${groupPlaylist.platform}, attempt ${tokenAttempts + 1}`);
          tokenAttempts++;
          if (tokenAttempts < maxTokenAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * tokenAttempts)); // Exponential backoff
            continue;
          }
          throw new Error(`No valid ${groupPlaylist.platform} token available after ${maxTokenAttempts} attempts`);
        }
      } catch (tokenError) {
        tokenAttempts++;
        console.error(`❌ Token error attempt ${tokenAttempts}:`, tokenError);
        if (tokenAttempts >= maxTokenAttempts) {
          throw new Error(`Failed to get valid token after ${maxTokenAttempts} attempts: ${tokenError.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * tokenAttempts)); // Exponential backoff
      }
    }

    // Convert submissions to platform-specific songs with better error handling
    const songs = await this.convertSubmissionsToPlatformSongs(submissions, groupPlaylist.platform);
    console.log(`🎵 Found ${songs.length} songs for ${groupPlaylist.platform} playlist`);

    // Update playlist with retry logic
    let updateAttempts = 0;
    const maxUpdateAttempts = 3;
    
    while (updateAttempts < maxUpdateAttempts) {
      try {
        if (groupPlaylist.platform === 'spotify') {
          await this.updateSpotifyPlaylist(freshToken!, groupPlaylist.platformPlaylistId, songs);
        } else if (groupPlaylist.platform === 'apple-music') {
          await this.updateAppleMusicPlaylist(freshToken!, groupPlaylist.platformPlaylistId, songs);
        }
        break; // Success, exit retry loop
      } catch (updateError) {
        updateAttempts++;
        console.error(`❌ Playlist update error attempt ${updateAttempts}:`, updateError);
        
        if (updateAttempts >= maxUpdateAttempts) {
          throw new Error(`Failed to update playlist after ${maxUpdateAttempts} attempts: ${updateError.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * updateAttempts));
        
        // For token-related errors, try to refresh token
        if (updateError.message.includes('token') || updateError.message.includes('401') || updateError.message.includes('unauthorized')) {
          console.log(`🔄 Refreshing token due to auth error...`);
          try {
            await musicService.refreshUserToken(playlistManager.id, groupPlaylist.platform);
            freshToken = await musicService.getValidUserToken(playlistManager.id, groupPlaylist.platform);
          } catch (refreshError) {
            console.error(`❌ Token refresh failed:`, refreshError);
          }
        }
      }
    }
  }

  /**
   * Clear all songs from a playlist
   */
  private static async clearPlaylist(groupPlaylist: any, group: any): Promise<void> {
    const playlistManager = await this.findPlaylistManager(group, groupPlaylist.platform);
    if (!playlistManager) return;

    const { musicService } = await import('./musicService');
    const freshToken = await musicService.getValidUserToken(playlistManager.id, groupPlaylist.platform);
    if (!freshToken) return;

    if (groupPlaylist.platform === 'spotify') {
      await this.updateSpotifyPlaylist(freshToken, groupPlaylist.platformPlaylistId, []);
    } else if (groupPlaylist.platform === 'apple-music') {
      await this.updateAppleMusicPlaylist(freshToken, groupPlaylist.platformPlaylistId, []);
    }
  }

  /**
   * Update Spotify playlist - replace all tracks
   * Enhanced with better error handling and validation
   */
  private static async updateSpotifyPlaylist(accessToken: string, playlistId: string, songs: any[]): Promise<void> {
    const spotifyApi = 'https://api.spotify.com/v1';

    try {
      // Validate playlist exists first
      const playlistResponse = await axios.get(`${spotifyApi}/playlists/${playlistId}`, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (!playlistResponse.data) {
        throw new Error(`Spotify playlist ${playlistId} not found`);
      }

      // First, clear the playlist by replacing with empty array
      await axios.put(`${spotifyApi}/playlists/${playlistId}/tracks`, {
        uris: [], // Empty array clears the playlist
      }, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Then add new tracks if any
      if (songs.length > 0) {
        // Validate track URIs and filter out invalid ones
        const validTrackUris = songs
          .filter(song => song.platformId && song.platformId.trim())
          .map(song => {
            const trackId = song.platformId.replace(/^spotify:track:/, '').trim();
            return `spotify:track:${trackId}`;
          });
        
        if (validTrackUris.length > 0) {
          // Spotify has a limit of 100 tracks per request
          const batchSize = 100;
          for (let i = 0; i < validTrackUris.length; i += batchSize) {
            const batch = validTrackUris.slice(i, i + batchSize);
            
            if (i === 0) {
              // First batch: replace tracks
              await axios.put(`${spotifyApi}/playlists/${playlistId}/tracks`, {
                uris: batch,
              }, {
                headers: { 
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              });
            } else {
              // Subsequent batches: add tracks
              await axios.post(`${spotifyApi}/playlists/${playlistId}/tracks`, {
                uris: batch,
              }, {
                headers: { 
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              });
            }
          }
        }
        
        console.log(`✅ Spotify playlist updated with ${validTrackUris.length}/${songs.length} valid tracks`);
      } else {
        console.log(`✅ Spotify playlist cleared (no tracks to add)`);
      }
    } catch (error) {
      console.error(`❌ Spotify playlist update failed:`, error);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        throw new Error(`Spotify playlist ${playlistId} not found or deleted`);
      } else if (error.response?.status === 401) {
        throw new Error(`Spotify token expired or invalid`);
      } else if (error.response?.status === 403) {
        throw new Error(`Insufficient permissions to modify Spotify playlist`);
      } else {
        throw new Error(`Failed to update Spotify playlist: ${error.message}`);
      }
    }
  }

  /**
   * Update Apple Music playlist - replace all tracks
   * Enhanced with better error handling and validation
   */
  private static async updateAppleMusicPlaylist(accessToken: string, playlistId: string, songs: any[]): Promise<void> {
    try {
      const { appleMusicService } = await import('./appleMusicService');
      
      // Validate and filter track IDs
      const validTrackIds = songs
        .filter(song => song.platformId && song.platformId.trim())
        .map(song => song.platformId.trim());
      
      console.log(`🎵 Updating Apple Music playlist with ${validTrackIds.length}/${songs.length} valid tracks`);
      
      // Apple Music playlist update - clear and add new songs
      await appleMusicService.updatePlaylistTracks(accessToken, playlistId, validTrackIds);
      
      console.log(`✅ Apple Music playlist updated with ${validTrackIds.length} tracks`);
    } catch (error) {
      console.error('❌ Apple Music playlist update error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        throw new Error(`Apple Music playlist ${playlistId} not found or deleted`);
      } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
        throw new Error(`Apple Music token expired or invalid`);
      } else if (error.message?.includes('403') || error.message?.includes('forbidden')) {
        throw new Error(`Insufficient permissions to modify Apple Music playlist`);
      } else {
        throw new Error(`Failed to update Apple Music playlist: ${error.message}`);
      }
    }
  }

  /**
   * Convert submissions to platform-specific songs
   * Enhanced with better cross-platform matching and error handling
   */
  private static async convertSubmissionsToPlatformSongs(submissions: any[], platform: string): Promise<any[]> {
    const songs = [];
    const failedMatches = [];
    
    for (const submission of submissions) {
      try {
        const song = submission.song;
        const platformIds = song.platformIds as Record<string, string>;
        const platformId = platformIds[platform];
        
        if (platformId && platformId.trim()) {
          // Song exists on this platform
          songs.push({
            platformId: platformId.trim(),
            title: song.title,
            artist: song.artist,
            submittedBy: submission.user.displayName,
            originalSongId: song.id,
          });
          console.log(`✅ Direct match found for "${song.title}" on ${platform}`);
        } else {
          // Try cross-platform matching with improved logic
          console.log(`🔍 Searching for cross-platform match for "${song.title}" by ${song.artist} on ${platform}`);
          
          try {
            const { musicService } = await import('./musicService');
            
            // Enhanced search query with better formatting
            const searchQuery = {
              title: song.title.trim(),
              artist: song.artist.trim(),
              album: song.album?.trim() || '',
            };
            
            const matchResults = await musicService.matchSongAcrossPlatforms(
              [searchQuery],
              platform
            );
            
            if (matchResults && matchResults.length > 0) {
              const result = matchResults[0];
              
              // Lower confidence threshold for better matching but still reliable
              if (result?.bestMatch && result.confidence > 0.6) {
                const bestMatch = result.bestMatch;
                songs.push({
                  platformId: bestMatch.platformId,
                  title: bestMatch.title,
                  artist: bestMatch.artist,
                  submittedBy: submission.user.displayName,
                  isCrossPlatformMatch: true,
                  matchConfidence: result.confidence,
                  originalSongId: song.id,
                });
                
                console.log(`✅ Cross-platform match found for "${song.title}" with confidence ${result.confidence}`);
                
                // Update the original song with the new platform ID for future use
                try {
                  const updatedPlatformIds = { ...platformIds, [platform]: bestMatch.platformId };
                  await prisma.song.update({
                    where: { id: song.id },
                    data: { platformIds: updatedPlatformIds },
                  });
                  console.log(`💾 Saved ${platform} ID for future use: ${bestMatch.platformId}`);
                } catch (saveError) {
                  console.warn(`⚠️ Failed to save ${platform} ID for song ${song.id}:`, saveError);
                }
              } else {
                console.log(`⚠️ Low confidence match (${result?.confidence || 'unknown'}) for "${song.title}" on ${platform}`);
                failedMatches.push({
                  title: song.title,
                  artist: song.artist,
                  reason: 'Low confidence match',
                  confidence: result?.confidence,
                });
              }
            } else {
              console.log(`❌ No matches found for "${song.title}" on ${platform}`);
              failedMatches.push({
                title: song.title,
                artist: song.artist,
                reason: 'No matches found',
              });
            }
          } catch (matchError) {
            console.error(`❌ Cross-platform matching failed for "${song.title}":`, matchError);
            failedMatches.push({
              title: song.title,
              artist: song.artist,
              reason: `Matching error: ${matchError.message}`,
            });
          }
        }
      } catch (songError) {
        console.error(`❌ Error processing song from submission ${submission.id}:`, songError);
        failedMatches.push({
          title: submission.song?.title || 'Unknown',
          artist: submission.song?.artist || 'Unknown',
          reason: `Processing error: ${songError.message}`,
        });
      }
    }
    
    if (failedMatches.length > 0) {
      console.log(`⚠️ ${failedMatches.length} songs could not be matched for ${platform}:`);
      failedMatches.forEach(failed => {
        console.log(`  - "${failed.title}" by ${failed.artist}: ${failed.reason}`);
      });
    }
    
    console.log(`🎵 Successfully matched ${songs.length}/${submissions.length} songs for ${platform}`);
    return songs;
  }

  /**
   * Create a new platform playlist for the group
   */
  private static async createPlatformPlaylist(
    user: any,
    platform: string,
    groupName: string,
    groupId: string
  ) {
    console.log(`🆕 Creating ${platform} playlist for group "${groupName}" with user ${user.displayName}`);

    try {
      const { musicService } = await import('./musicService');
      
      // Check if user has a valid token
      console.log(`🔑 Getting valid token for user ${user.id} on ${platform}`);
      const freshToken = await musicService.getValidUserToken(user.id, platform);
      if (!freshToken) {
        throw new Error(`No valid ${platform} token available for user ${user.displayName}. Please reconnect the ${platform} account.`);
      }

      const playlistName = `${groupName.toLowerCase()} mixtape`;
      let playlistResult;

      if (platform === 'spotify') {
        playlistResult = await this.createSpotifyGroupPlaylist(freshToken, playlistName);
      } else if (platform === 'apple-music') {
        playlistResult = await this.createAppleMusicGroupPlaylist(freshToken, playlistName);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      console.log(`💾 Saving playlist to database: ${playlistResult.playlistId}`);
      
      // Save to database
      const groupPlaylist = await prisma.groupPlaylist.create({
        data: {
          groupId,
          userId: user.id,
          platform,
          platformPlaylistId: playlistResult.playlistId,
          playlistName,
          playlistUrl: playlistResult.playlistUrl,
        },
      });

      console.log(`✅ Successfully created and saved ${platform} playlist`);
      return groupPlaylist;
    } catch (error) {
      console.error(`❌ Failed to create ${platform} playlist:`, error.message);
      throw error; // Re-throw with original error message
    }
  }

  /**
   * Create Spotify group playlist
   */
  private static async createSpotifyGroupPlaylist(accessToken: string, name: string) {
    const spotifyApi = 'https://api.spotify.com/v1';
    
    try {
      console.log(`🎵 Creating Spotify playlist "${name}"`);
      
      // Get user profile
      const profileResponse = await axios.get(`${spotifyApi}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const userId = profileResponse.data.id;
      console.log(`✅ Got Spotify user profile: ${userId}`);

      // Create playlist
      const playlistResponse = await axios.post(`${spotifyApi}/users/${userId}/playlists`, {
        name,
        description: 'Automatically updated every morning at 8am with fresh submissions from your group',
        public: false,
        collaborative: false, // Keep it managed by the system
      }, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Created Spotify playlist: ${playlistResponse.data.id}`);
      
      return {
        playlistId: playlistResponse.data.id,
        playlistUrl: playlistResponse.data.external_urls.spotify,
      };
    } catch (error) {
      console.error(`❌ Spotify playlist creation failed:`, error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Spotify token is invalid or expired. Please reconnect your Spotify account.');
      } else if (error.response?.status === 403) {
        throw new Error('Insufficient Spotify permissions. Please reconnect your Spotify account with playlist creation permissions.');
      } else if (error.response?.status === 429) {
        throw new Error('Spotify API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Failed to create Spotify playlist: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }

  /**
   * Create Apple Music group playlist with real MusicKit integration
   */
  private static async createAppleMusicGroupPlaylist(musicUserToken: string, name: string) {
    try {
      console.log(`🍎 Creating Apple Music playlist "${name}" with MusicKit`);
      
      // Validate that this is a proper Music User Token
      if (!musicUserToken || musicUserToken.trim() === '') {
        throw new Error('Empty or missing Music User Token');
      }
      
      // Check for obvious Apple ID tokens and reject them
      if (musicUserToken.includes('eyJraWQiOiJVYUlJRlkyZlc0') || musicUserToken.startsWith('eyJhbGciOiJSUzI1NiI')) {
        throw new Error('Invalid token: This appears to be an Apple ID token. Please provide a Music User Token from MusicKit.js authorization.');
      }
      
      console.log(`🔑 Using Music User Token for playlist creation (length: ${musicUserToken.length})`);
      
      const { appleMusicService } = await import('./appleMusicService');
      
      const playlist = await appleMusicService.createPlaylist(musicUserToken, {
        name,
        description: 'Automatically updated every morning at 8am with fresh submissions from your group',
        songs: [], // Start empty
      });
      
      console.log(`✅ Successfully created Apple Music playlist:`, {
        id: playlist.id,
        name: playlist.attributes?.name || name
      });
      
      return {
        playlistId: playlist.id,
        playlistUrl: `https://music.apple.com/library/playlist/${playlist.id}`,
      };
    } catch (error) {
      console.error(`❌ Apple Music playlist creation failed:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
        throw new Error('Apple Music authentication failed. Please ensure you have a valid Music User Token from MusicKit.js and proper playlist permissions.');
      } else if (error.message?.includes('403') || error.message?.includes('forbidden')) {
        throw new Error('Insufficient Apple Music permissions. Please grant playlist creation permissions in MusicKit authorization.');
      } else if (error.message?.includes('Invalid token')) {
        throw error; // Re-throw our token validation errors
      } else {
        throw new Error(`Apple Music playlist creation failed: ${error.message}`);
      }
    }
  }

  /**
   * Find platforms used by group members
   */
  private static getPlatformsUsedByGroup(members: any[]): string[] {
    const platforms = new Set<string>();
    
    for (const member of members) {
      // Check user's preferred platform first
      const preferredPlatform = member.user.musicPreferences?.preferredPlatform;
      if (preferredPlatform && member.user.musicAccounts.some((acc: any) => acc.platform === preferredPlatform)) {
        platforms.add(preferredPlatform);
      } else {
        // Add all platforms the user has accounts for
        member.user.musicAccounts.forEach((account: any) => {
          platforms.add(account.platform);
        });
      }
    }
    
    return Array.from(platforms);
  }

  /**
   * Update Spotify playlist name
   */
  static async updateSpotifyPlaylistName(accessToken: string, playlistId: string, name: string): Promise<void> {
    const spotifyApi = 'https://api.spotify.com/v1';

    try {
      console.log(`🎵 Updating Spotify playlist ${playlistId} name to: "${name}"`);
      
      const response = await axios.put(`${spotifyApi}/playlists/${playlistId}`, {
        name,
        description: 'Automatically updated every morning at 8am with fresh submissions from your group',
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`✅ Spotify API response status: ${response.status}`);
      console.log(`✅ Successfully updated Spotify playlist name to: "${name}"`);
    } catch (error) {
      console.error('❌ Failed to update Spotify playlist name:', {
        playlistId,
        requestedName: name,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        throw new Error(`Spotify playlist ${playlistId} not found or deleted`);
      } else if (error.response?.status === 401) {
        throw new Error(`Spotify token expired or invalid`);
      } else if (error.response?.status === 403) {
        throw new Error(`Insufficient permissions to modify Spotify playlist. Required scopes: playlist-modify-public, playlist-modify-private`);
      } else {
        throw new Error(`Failed to update Spotify playlist name: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }

  /**
   * Update all playlist names when group name changes
   */
  static async updateAllPlaylistNames(groupId: string, newGroupName: string): Promise<void> {
    console.log(`🔄 Updating all playlist names for group: ${groupId} to: ${newGroupName}`);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPlaylists: {
          where: { isActive: true }
        }
      },
    });

    if (!group || group.groupPlaylists.length === 0) {
      console.log('ℹ️ No playlists found to update');
      return;
    }

    const newPlaylistName = `${newGroupName.toLowerCase()} mixtape`;
    console.log(`📝 Will update playlist name to: "${newPlaylistName}"`);

    // First, try to update all playlists on platforms
    const platformUpdateResults = [];
    for (const playlist of group.groupPlaylists) {
      try {
        console.log(`🔄 Processing ${playlist.platform} playlist: ${playlist.playlistName} (ID: ${playlist.platformPlaylistId})`);
        
        const playlistManager = await this.findPlaylistManager(group, playlist.platform);
        if (!playlistManager) {
          console.log(`⚠️ No playlist manager found for ${playlist.platform}`);
          platformUpdateResults.push({ 
            platform: playlist.platform, 
            success: false, 
            error: 'No playlist manager found' 
          });
          continue;
        }
        console.log(`👤 Found playlist manager: ${playlistManager.displayName} (${playlistManager.id})`);

        const { musicService } = await import('./musicService');
        const freshToken = await musicService.getValidUserToken(playlistManager.id, playlist.platform);
        if (!freshToken) {
          console.log(`⚠️ No valid token for ${playlist.platform} user ${playlistManager.id}`);
          platformUpdateResults.push({ 
            platform: playlist.platform, 
            success: false, 
            error: 'No valid token available' 
          });
          continue;
        }
        console.log(`🔑 Got valid token for ${playlist.platform}`);

        if (playlist.platform === 'spotify') {
          await this.updateSpotifyPlaylistName(freshToken, playlist.platformPlaylistId, newPlaylistName);
        }

        console.log(`✅ Updated ${playlist.platform} playlist name to: ${newPlaylistName}`);
        platformUpdateResults.push({ 
          platform: playlist.platform, 
          success: true 
        });
      } catch (error) {
        console.error(`❌ Failed to update ${playlist.platform} playlist name:`, {
          platform: playlist.platform,
          playlistId: playlist.platformPlaylistId,
          playlistName: playlist.playlistName,
          newName: newPlaylistName,
          error: error.message,
        });
        platformUpdateResults.push({ 
          platform: playlist.platform, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Check if any platform updates succeeded
    const successfulUpdates = platformUpdateResults.filter(result => result.success);
    const failedUpdates = platformUpdateResults.filter(result => !result.success);

    if (successfulUpdates.length === 0 && failedUpdates.length > 0) {
      // All platform updates failed, don't update database
      console.log('❌ All platform updates failed, not updating database');
      const errorMessages = failedUpdates.map(f => `${f.platform}: ${f.error}`).join(', ');
      throw new Error(`Failed to update playlists on all platforms: ${errorMessages}`);
    }

    // Update database only if at least one platform update succeeded
    await prisma.groupPlaylist.updateMany({
      where: {
        groupId: group.id,
        isActive: true,
      },
      data: {
        playlistName: newPlaylistName,
      },
    });

    if (failedUpdates.length > 0) {
      console.log(`⚠️ Some platform updates failed: ${failedUpdates.map(f => f.platform).join(', ')}`);
    }

    console.log(`✅ Finished updating all playlist names for group`);
  }

  /**
   * Find a user who can manage the playlist for a specific platform
   */
  static async findPlaylistManager(group: any, platform: string, requestingUserId?: string) {
    // Priority: requesting user > admin > any member
    
    // Try requesting user first if provided
    if (requestingUserId) {
      const requestingUser = await this.findUserWithPlatform(requestingUserId, platform);
      if (requestingUser) return requestingUser;
    }
    
    // Try admin next
    const admin = await this.findUserWithPlatform(group.adminUserId, platform);
    if (admin) return admin;

    // Otherwise find any member with the platform
    const memberWithPlatform = group.members.find((member: any) => 
      member.user.musicAccounts.some((account: any) => account.platform === platform)
    );

    return memberWithPlatform?.user || null;
  }

  /**
   * Find user with specific platform account
   */
  private static async findUserWithPlatform(userId: string, platform: string) {
    return await prisma.user.findFirst({
      where: {
        id: userId,
        musicAccounts: {
          some: { platform },
        },
      },
      include: {
        musicAccounts: true,
      },
    });
  }

  /**
   * Create platform playlist atomically to prevent race conditions
   */
  private static async createPlatformPlaylistAtomic(
    group: any,
    platform: string,
    requestingUserId?: string
  ) {
    console.log(`🆕 Creating new ${platform} playlist for group ${group.name}`);
    
    // Find a group member with this platform to create the playlist
    // Priority: requesting user > admin > any member
    let creatorUser = null;
    
    // Find the best user to create playlist for this platform
    // Priority: admin first, then any group member with the platform
    console.log(`🔍 Finding user with ${platform} account for playlist creation`);
    creatorUser = await this.findUserWithPlatform(group.adminUserId, platform);
    
    if (!creatorUser) {
      // Admin doesn't have this platform, find any group member who does
      console.log(`⚠️ Admin doesn't have ${platform} account, finding group member...`);
      const memberWithPlatform = group.members.find((member: any) => 
        member.user.musicAccounts.some((account: any) => account.platform === platform)
      );
      
      if (!memberWithPlatform) {
        throw new Error(`No group members have ${platform} accounts`);
      }
      
      creatorUser = memberWithPlatform.user;
      console.log(`✅ Using group member ${creatorUser.displayName}'s ${platform} account`);
    } else {
      console.log(`✅ Using admin's ${platform} account for playlist creation`);
    }
    
    // Get user's music account token and create real playlist
    const { musicService } = await import('./musicService');
    const freshToken = await musicService.getValidUserToken(creatorUser.id, platform);
    
    if (!freshToken) {
      throw new Error(`No valid ${platform} token available for user ${creatorUser.displayName}. Please reconnect your ${platform} account.`);
    }
    
    // For development, still allow fake tokens for non-Apple Music platforms
    if (freshToken.startsWith('fake_') && platform !== 'apple-music') {
      console.log(`⚠️ Fake token detected for ${platform}. Creating mock playlist for development.`);
      return await this.createMockPlatformPlaylist(
        creatorUser,
        platform,
        group.name,
        group.id
      );
    }
    
    // For Apple Music, reject any demo/fake tokens - we want real integration only
    if (platform === 'apple-music' && (freshToken.startsWith('demo_') || freshToken.startsWith('fake_'))) {
      throw new Error('Apple Music requires a real Music User Token from MusicKit. Please authenticate with MusicKit.js to create playlists.');
    }
    
    console.log(`🎵 Creating real ${platform} playlist for ${creatorUser.displayName}`);
    
    // Create the real playlist
    return await this.createPlatformPlaylist(
      creatorUser,
      platform,
      group.name,
      group.id
    );
  }

  /**
   * Validate that a playlist still exists on the platform
   */
  private static async validatePlaylistExists(groupPlaylist: any): Promise<boolean> {
    try {
      if (!groupPlaylist || !groupPlaylist.platformPlaylistId) {
        return false;
      }

      // For now, we'll assume playlists exist unless we get a specific error
      // In a full implementation, this would make API calls to check playlist existence
      if (groupPlaylist.platform === 'spotify') {
        return await this.validateSpotifyPlaylistExists(groupPlaylist.platformPlaylistId);
      } else if (groupPlaylist.platform === 'apple-music') {
        return await this.validateAppleMusicPlaylistExists(groupPlaylist.platformPlaylistId);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error validating playlist existence:`, error);
      return false;
    }
  }

  /**
   * Validate Spotify playlist exists
   */
  private static async validateSpotifyPlaylistExists(playlistId: string): Promise<boolean> {
    try {
      // This would require a token, so for now we'll do a basic validation
      // In a full implementation, make a GET request to Spotify API
      return playlistId && playlistId.length > 0;
    } catch (error) {
      console.error(`❌ Error validating Spotify playlist:`, error);
      return false;
    }
  }

  /**
   * Validate Apple Music playlist exists
   */
  private static async validateAppleMusicPlaylistExists(playlistId: string): Promise<boolean> {
    try {
      // This would require a token, so for now we'll do a basic validation
      // In a full implementation, make a GET request to Apple Music API
      return playlistId && playlistId.length > 0;
    } catch (error) {
      console.error(`❌ Error validating Apple Music playlist:`, error);
      return false;
    }
  }

  /**
   * Delete all playlists for a group when the group is being deleted
   */
  static async deleteAllGroupPlaylists(groupId: string): Promise<void> {
    console.log(`🗑️ Deleting all playlists for group: ${groupId}`);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPlaylists: {
          where: { isActive: true }
        },
        members: {
          include: {
            user: {
              include: {
                musicAccounts: true,
              },
            },
          },
        },
      },
    });

    if (!group || group.groupPlaylists.length === 0) {
      console.log('ℹ️ No playlists found to delete');
      return;
    }

    // Delete playlists from each platform
    for (const playlist of group.groupPlaylists) {
      try {
        console.log(`🗑️ Deleting ${playlist.platform} playlist: ${playlist.playlistName} (ID: ${playlist.platformPlaylistId})`);
        
        // Skip deletion for mock playlists
        if (playlist.platformPlaylistId.startsWith('mock_')) {
          console.log(`⚠️ Skipping deletion of mock playlist: ${playlist.platformPlaylistId}`);
        } else {
          const playlistManager = await this.findPlaylistManager(group, playlist.platform);
          if (!playlistManager) {
            console.log(`⚠️ No playlist manager found for ${playlist.platform}, skipping platform deletion`);
          } else {
            const { musicService } = await import('./musicService');
            const freshToken = await musicService.getValidUserToken(playlistManager.id, playlist.platform);
            if (!freshToken) {
              console.log(`⚠️ No valid token for ${playlist.platform}, skipping platform deletion`);
            } else {
              // Delete from platform
              if (playlist.platform === 'spotify') {
                await this.deleteSpotifyPlaylist(freshToken, playlist.platformPlaylistId);
              } else if (playlist.platform === 'apple-music') {
                await this.deleteAppleMusicPlaylist(freshToken, playlist.platformPlaylistId);
              }
              console.log(`✅ Deleted ${playlist.platform} playlist from platform`);
            }
          }
        }

        // Mark as inactive in database
        await prisma.groupPlaylist.update({
          where: { id: playlist.id },
          data: { isActive: false },
        });

      } catch (error) {
        console.error(`❌ Failed to delete ${playlist.platform} playlist:`, error);
        // Continue with other playlists even if one fails
      }
    }

    console.log(`✅ Finished deleting all playlists for group ${groupId}`);
  }

  /**
   * Delete Spotify playlist
   */
  private static async deleteSpotifyPlaylist(accessToken: string, playlistId: string): Promise<void> {
    const spotifyApi = 'https://api.spotify.com/v1';

    try {
      console.log(`🎵 Deleting Spotify playlist: ${playlistId}`);
      
      // Note: Spotify doesn't allow playlist deletion via API, but we can unfollow it
      // This effectively removes it from the user's playlists
      await axios.delete(`${spotifyApi}/playlists/${playlistId}/followers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      console.log(`✅ Successfully unfollowed Spotify playlist: ${playlistId}`);
    } catch (error) {
      console.error('❌ Failed to delete Spotify playlist:', {
        playlistId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        console.log(`ℹ️ Spotify playlist ${playlistId} already deleted or not found`);
      } else if (error.response?.status === 401) {
        throw new Error(`Spotify token expired or invalid`);
      } else if (error.response?.status === 403) {
        throw new Error(`Insufficient permissions to delete Spotify playlist`);
      } else {
        throw new Error(`Failed to delete Spotify playlist: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }

  /**
   * Delete Apple Music playlist
   */
  private static async deleteAppleMusicPlaylist(accessToken: string, playlistId: string): Promise<void> {
    try {
      console.log(`🍎 Attempting to delete Apple Music playlist: ${playlistId}`);
      
      // Apple Music API doesn't support playlist deletion through their service
      // The playlist will remain but be marked as inactive in our database
      console.log(`⚠️ Apple Music playlist deletion not implemented - playlist will remain on platform but be marked inactive in database`);
      
    } catch (error) {
      console.error(`❌ Apple Music playlist deletion failed:`, error.message);
      throw new Error(`Failed to delete Apple Music playlist: ${error.message}`);
    }
  }

  /**
   * Create a mock playlist for development/testing when no valid tokens are available
   */
  private static async createMockPlatformPlaylist(
    user: any,
    platform: string,
    groupName: string,
    groupId: string
  ) {
    const playlistName = `${groupName.toLowerCase()} mixtape`;
    const mockPlaylistId = `mock_${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let playlistUrl;
    let logMessage;
    
    if (platform === 'apple-music') {
      console.log(`🍎 Creating Apple Music demo playlist - authentication is connected but needs MusicKit integration`);
      playlistUrl = `https://music.apple.com/library/playlist/${mockPlaylistId}`;
      logMessage = `✅ Created Apple Music demo playlist. To create real playlists, please integrate MusicKit.js on the frontend.`;
    } else if (platform === 'spotify') {
      console.log(`🎭 Creating MOCK ${platform} playlist for development`);
      playlistUrl = `https://open.spotify.com/playlist/${mockPlaylistId}`;
      logMessage = `✅ Successfully created mock ${platform} playlist for development`;
    } else {
      console.log(`🎭 Creating MOCK ${platform} playlist for development`);
      playlistUrl = `https://example.com/${platform}/playlist/${mockPlaylistId}`;
      logMessage = `✅ Successfully created mock ${platform} playlist for development`;
    }

    console.log(`💾 Saving playlist to database: ${mockPlaylistId}`);
    
    // Save to database
    const groupPlaylist = await prisma.groupPlaylist.create({
      data: {
        groupId,
        userId: user.id,
        platform,
        platformPlaylistId: mockPlaylistId,
        playlistName,
        playlistUrl,
      },
    });

    console.log(logMessage);
    
    if (platform !== 'apple-music') {
      console.log(`⚠️ This is a MOCK playlist. Connect real music accounts to create actual playlists.`);
    }
    
    return groupPlaylist;
  }

  /**
   * Create individual playlists for all group members (NEW SYSTEM)
   */
  static async createIndividualGroupPlaylists(groupId: string): Promise<any[]> {
    console.log(`🎵 Creating individual playlists for all group members: ${groupId}`);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              include: {
                musicAccounts: true,
                groupPlaylists: {
                  where: { groupId, isActive: true },
                },
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const createdPlaylists: any[] = [];

    // Create individual playlists for each group member in their own accounts
    for (const member of group.members) {
      const user = member.user;
      console.log(`👤 Processing playlists for user: ${user.displayName}`);

      // Create playlist for each platform the user has connected
      for (const musicAccount of user.musicAccounts) {
        const platform = musicAccount.platform;
        
        // Check if user already has a playlist for this group on this platform
        const existingPlaylist = user.groupPlaylists.find(
          gp => gp.groupId === groupId && gp.platform === platform && gp.isActive
        );

        if (existingPlaylist) {
          console.log(`✅ ${user.displayName} already has ${platform} playlist: ${existingPlaylist.playlistName}`);
          createdPlaylists.push({
            groupId,
            platform: existingPlaylist.platform as 'spotify' | 'apple-music',
            playlistId: existingPlaylist.platformPlaylistId,
            playlistUrl: existingPlaylist.playlistUrl,
          });
          continue;
        }

        // Create new playlist for this user
        try {
          console.log(`🆕 Creating ${platform} playlist for ${user.displayName}`);
          console.log(`🔑 User ${user.displayName} music accounts:`, user.musicAccounts.map(acc => ({ platform: acc.platform, hasToken: !!acc.accessToken })));
          
          const newPlaylist = await this.createUserPlaylist(user, group, platform);
          
          console.log(`✅ Successfully created ${platform} playlist for ${user.displayName}: ${newPlaylist.playlistName}`);
          
          createdPlaylists.push({
            groupId,
            platform: newPlaylist.platform as 'spotify' | 'apple-music',
            playlistId: newPlaylist.platformPlaylistId,
            playlistUrl: newPlaylist.playlistUrl,
          });
        } catch (error) {
          console.error(`❌ Failed to create ${platform} playlist for ${user.displayName}:`, error);
          console.error(`❌ Error details:`, {
            message: error.message,
            platform,
            userId: user.id,
            userName: user.displayName,
            userMusicAccounts: user.musicAccounts.length
          });
          // Continue with other users/platforms even if one fails
        }
      }
    }

    console.log(`✅ Created ${createdPlaylists.length} individual playlists for group members`);
    return createdPlaylists;
  }

  /**
   * Create individual playlist for a user in their account
   */
  private static async createUserPlaylist(user: any, group: any, platform: string) {
    console.log(`🆕 Creating ${platform} playlist for ${user.displayName} in group ${group.name}`);

    const playlistName = `${group.name.toLowerCase()} mixtape`;
    const { musicService } = await import('./musicService');
    
    // Get fresh token for the user
    const freshToken = await musicService.getValidUserToken(user.id, platform);
    if (!freshToken) {
      throw new Error(`No valid ${platform} token for user ${user.displayName}`);
    }

    let playlistResult;
    if (platform === 'spotify') {
      playlistResult = await this.createSpotifyGroupPlaylist(freshToken, playlistName);
    } else if (platform === 'apple-music') {
      playlistResult = await this.createAppleMusicGroupPlaylist(freshToken, playlistName);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Save to database with userId
    const groupPlaylist = await prisma.groupPlaylist.create({
      data: {
        groupId: group.id,
        userId: user.id,
        platform,
        platformPlaylistId: playlistResult.playlistId,
        playlistName,
        playlistUrl: playlistResult.playlistUrl,
      },
    });

    console.log(`✅ Created ${platform} playlist for ${user.displayName}: ${playlistName}`);
    return groupPlaylist;
  }
}