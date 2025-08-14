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
   */
  static async ensureGroupPlaylists(groupId: string): Promise<GroupPlaylistManager[]> {
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

    // Determine which platforms are used by group members
    const platformsInUse = this.getPlatformsUsedByGroup(group.members);
    console.log(`📱 Platforms used by group: ${platformsInUse.join(', ')}`);

    const groupPlaylists: GroupPlaylistManager[] = [];

    for (const platform of platformsInUse) {
      let groupPlaylist = group.groupPlaylists.find(gp => gp.platform === platform && gp.isActive);

      if (!groupPlaylist) {
        // Create new persistent group playlist
        console.log(`🆕 Creating new ${platform} playlist for group ${group.name}`);
        
        // Find a group member with this platform to create the playlist
        const adminUser = await this.findUserWithPlatform(group.adminUserId, platform);
        if (!adminUser) {
          console.log(`⚠️ Admin doesn't have ${platform} account, finding another member...`);
          const memberWithPlatform = group.members.find(member => 
            member.user.musicAccounts.some(account => account.platform === platform)
          );
          
          if (!memberWithPlatform) {
            console.log(`❌ No group members have ${platform} accounts`);
            continue;
          }
          
          const createdPlaylist = await this.createPlatformPlaylist(
            memberWithPlatform.user,
            platform,
            group.name,
            group.id
          );
          
          groupPlaylist = createdPlaylist;
        } else {
          const createdPlaylist = await this.createPlatformPlaylist(
            adminUser,
            platform,
            group.name,
            group.id
          );
          
          groupPlaylist = createdPlaylist;
        }
      }

      groupPlaylists.push({
        groupId,
        platform: platform as 'spotify' | 'apple-music',
        playlistId: groupPlaylist.platformPlaylistId,
        playlistUrl: groupPlaylist.playlistUrl || undefined,
      });
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

    // Get fresh token for the playlist manager
    const { musicService } = await import('./musicService');
    const tokenIsValid = await musicService.ensureValidToken(playlistManager.id, groupPlaylist.platform);
    if (!tokenIsValid) {
      throw new Error(`Unable to obtain valid ${groupPlaylist.platform} token`);
    }

    const freshToken = await musicService.getValidUserToken(playlistManager.id, groupPlaylist.platform);
    if (!freshToken) {
      throw new Error(`No valid ${groupPlaylist.platform} token available`);
    }

    // Convert submissions to platform-specific songs
    const songs = await this.convertSubmissionsToPlatformSongs(submissions, groupPlaylist.platform);

    if (groupPlaylist.platform === 'spotify') {
      await this.updateSpotifyPlaylist(freshToken, groupPlaylist.platformPlaylistId, songs);
    } else if (groupPlaylist.platform === 'apple-music') {
      await this.updateAppleMusicPlaylist(freshToken, groupPlaylist.platformPlaylistId, songs);
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
   */
  private static async updateSpotifyPlaylist(accessToken: string, playlistId: string, songs: any[]): Promise<void> {
    const spotifyApi = 'https://api.spotify.com/v1';

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
      const trackUris = songs.map(song => `spotify:track:${song.platformId}`);
      
      await axios.post(`${spotifyApi}/playlists/${playlistId}/tracks`, {
        uris: trackUris,
      }, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`✅ Spotify playlist updated with ${songs.length} tracks`);
  }

  /**
   * Update Apple Music playlist - replace all tracks
   */
  private static async updateAppleMusicPlaylist(accessToken: string, playlistId: string, songs: any[]): Promise<void> {
    try {
      const { appleMusicService } = await import('./appleMusicService');
      
      // Apple Music playlist update - clear and add new songs
      await appleMusicService.updatePlaylistTracks(accessToken, playlistId, songs.map(song => song.platformId));
      
      console.log(`✅ Apple Music playlist updated with ${songs.length} tracks`);
    } catch (error) {
      console.error('Apple Music playlist update error:', error);
      throw error;
    }
  }

  /**
   * Convert submissions to platform-specific songs
   */
  private static async convertSubmissionsToPlatformSongs(submissions: any[], platform: string): Promise<any[]> {
    const songs = [];
    
    for (const submission of submissions) {
      const song = submission.song;
      const platformIds = song.platformIds as Record<string, string>;
      const platformId = platformIds[platform];
      
      if (platformId) {
        // Song exists on this platform
        songs.push({
          platformId,
          title: song.title,
          artist: song.artist,
          submittedBy: submission.user.displayName,
        });
      } else {
        // Try cross-platform matching
        try {
          const { musicService } = await import('./musicService');
          const matchResults = await musicService.matchSongAcrossPlatforms(
            [{ title: song.title, artist: song.artist, album: song.album }],
            platform
          );
          
          if (matchResults[0]?.bestMatch && matchResults[0].confidence > 0.7) {
            const bestMatch = matchResults[0].bestMatch;
            songs.push({
              platformId: bestMatch.platformId,
              title: bestMatch.title,
              artist: bestMatch.artist,
              submittedBy: submission.user.displayName,
              isCrossPlatformMatch: true,
            });
          }
        } catch (error) {
          console.error(`Failed to find cross-platform match for "${song.title}":`, error);
        }
      }
    }
    
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
    console.log(`🆕 Creating ${platform} playlist for group "${groupName}"`);

    const { musicService } = await import('./musicService');
    const freshToken = await musicService.getValidUserToken(user.id, platform);
    if (!freshToken) {
      throw new Error(`No valid ${platform} token for user ${user.id}`);
    }

    const playlistName = `${groupName} Daily Mixtape`;
    let playlistResult;

    if (platform === 'spotify') {
      playlistResult = await this.createSpotifyGroupPlaylist(freshToken, playlistName);
    } else if (platform === 'apple-music') {
      playlistResult = await this.createAppleMusicGroupPlaylist(freshToken, playlistName);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Save to database
    const groupPlaylist = await prisma.groupPlaylist.create({
      data: {
        groupId,
        platform,
        platformPlaylistId: playlistResult.playlistId,
        playlistName,
        playlistUrl: playlistResult.playlistUrl,
      },
    });

    return groupPlaylist;
  }

  /**
   * Create Spotify group playlist
   */
  private static async createSpotifyGroupPlaylist(accessToken: string, name: string) {
    const spotifyApi = 'https://api.spotify.com/v1';
    
    // Get user profile
    const profileResponse = await axios.get(`${spotifyApi}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userId = profileResponse.data.id;

    // Create playlist
    const playlistResponse = await axios.post(`${spotifyApi}/users/${userId}/playlists`, {
      name,
      description: 'Daily music mixtape updated every morning at 8:30am with fresh submissions from your group',
      public: false,
      collaborative: false, // Keep it managed by the system
    }, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      playlistId: playlistResponse.data.id,
      playlistUrl: playlistResponse.data.external_urls.spotify,
    };
  }

  /**
   * Create Apple Music group playlist
   */
  private static async createAppleMusicGroupPlaylist(accessToken: string, name: string) {
    const { appleMusicService } = await import('./appleMusicService');
    
    const playlist = await appleMusicService.createPlaylist(accessToken, {
      name,
      description: 'Daily music mixtape updated every morning at 8:30am with fresh submissions from your group',
      songs: [], // Start empty
    });
    
    return {
      playlistId: playlist.id,
      playlistUrl: `https://music.apple.com/playlist/${playlist.id}`,
    };
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
   * Find a user who can manage the playlist for a specific platform
   */
  private static async findPlaylistManager(group: any, platform: string) {
    // Try admin first
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
}