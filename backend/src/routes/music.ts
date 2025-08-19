import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { musicService } from '../services/musicService';
import { prisma } from '../config/database';

const router = express.Router();

router.get('/search',
  authenticateToken,
  [
    query('q').isString().isLength({ min: 1 }).trim(),
    query('platform').optional().isIn(['spotify', 'apple-music']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { q, platform, limit = 20 } = req.query;
      const platforms = platform ? [platform as string] : ['spotify', 'apple-music'];
      
      const results = await musicService.searchAcrossPlatforms(
        q as string,
        platforms,
        parseInt(limit as string)
      );

      res.json({
        songs: results,
        total: results.length,
        query: q,
        platforms,
      });
    } catch (error) {
      console.error('Music search error:', error);
      res.status(500).json({ error: 'Music search failed' });
    }
  }
);

router.get('/song/:id',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const song = await prisma.song.findUnique({
        where: { id },
        include: {
          submissions: {
            include: {
              user: {
                select: { displayName: true }
              }
            }
          }
        }
      });

      if (!song) {
        return res.status(404).json({ error: 'Song not found' });
      }

      res.json(song);
    } catch (error) {
      console.error('Get song error:', error);
      res.status(500).json({ error: 'Failed to get song details' });
    }
  }
);

router.post('/songs',
  authenticateToken,
  [
    body('title').isString().notEmpty(),
    body('artist').isString().notEmpty(),
    body('album').optional().isString(),
    body('platformIds').isObject(),
    body('duration').optional().isInt(),
    body('imageUrl').optional().isURL(),
    body('previewUrl').optional().isURL(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      
      const { title, artist, album, platformIds, duration, imageUrl, previewUrl } = req.body;

      // Check if song already exists
      let song = await prisma.song.findFirst({
        where: {
          title,
          artist,
          album: album || null,
        },
      });

      if (!song) {
        // Create new song
        song = await prisma.song.create({
          data: {
            title,
            artist,
            album,
            platformIds,
            duration,
            imageUrl,
            previewUrl,
          },
        });
      } else {
        // Update platform IDs if new ones are provided
        const updatedPlatformIds = { ...(song.platformIds as Record<string, string>), ...platformIds };
        song = await prisma.song.update({
          where: { id: song.id },
          data: { platformIds: updatedPlatformIds },
        });
      }

      res.json({ song });
    } catch (error) {
      console.error('Create/update song error:', error);
      res.status(500).json({ error: 'Failed to create or update song' });
    }
  }
);

router.post('/songs/match',
  authenticateToken,
  [
    body('songs').isArray(),
    body('songs.*.title').isString().notEmpty(),
    body('songs.*.artist').isString().notEmpty(),
    body('songs.*.album').optional().isString(),
    body('targetPlatform').isIn(['spotify', 'apple-music']),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { songs, targetPlatform } = req.body;

      console.log(`🎵 Song matching request: ${songs.length} songs to ${targetPlatform}`);
      const matchResults = await musicService.matchSongAcrossPlatforms(songs, targetPlatform);

      // Calculate statistics
      const successfulMatches = matchResults.filter(result => result.matches.length > 0);
      const highConfidenceMatches = matchResults.filter(result => result.confidence > 0.8);

      res.json({
        matches: matchResults,
        targetPlatform,
        statistics: {
          totalSongs: songs.length,
          successfulMatches: successfulMatches.length,
          highConfidenceMatches: highConfidenceMatches.length,
          averageConfidence: matchResults.reduce((sum, result) => sum + result.confidence, 0) / matchResults.length,
        },
      });
    } catch (error) {
      console.error('Song matching error:', error);
      res.status(500).json({ error: 'Song matching failed' });
    }
  }
);

// Bulk song matching across multiple platforms
router.post('/songs/bulk-match',
  authenticateToken,
  [
    body('songs').isArray(),
    body('songs.*.id').isString().notEmpty(),
    body('songs.*.title').isString().notEmpty(),
    body('songs.*.artist').isString().notEmpty(),
    body('songs.*.album').optional().isString(),
    body('targetPlatforms').isArray(),
    body('targetPlatforms.*').isIn(['spotify', 'apple-music']),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    const startTime = Date.now();
    
    try {
      const { songs, targetPlatforms } = req.body;

      console.log(`🔄 Bulk matching request: ${songs.length} songs across ${targetPlatforms.length} platforms`);
      const matchResults = await musicService.bulkMatchSongs(songs, targetPlatforms);

      // Calculate statistics per platform
      const platformStats = targetPlatforms.reduce((stats: any, platform: string) => {
        const platformMatches = Object.values(matchResults).map((result: any) => 
          result.platformMatches[platform]?.length || 0
        );
        
        stats[platform] = {
          totalMatches: platformMatches.reduce((sum, count) => sum + count, 0),
          songsWithMatches: platformMatches.filter(count => count > 0).length,
          averageMatchesPerSong: platformMatches.reduce((sum, count) => sum + count, 0) / songs.length,
        };
        
        return stats;
      }, {});

      res.json({
        results: matchResults,
        targetPlatforms,
        statistics: {
          totalSongs: songs.length,
          platformStats,
          processingTimeSeconds: Math.round((Date.now() - startTime) / 1000),
        },
      });
    } catch (error) {
      console.error('Bulk song matching error:', error);
      res.status(500).json({ error: 'Bulk song matching failed' });
    }
  }
);

router.get('/platforms',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      // Check which platforms have proper configuration
      const spotifyAvailable = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
      const appleMusicAvailable = !!(process.env.APPLE_MUSIC_KEY_ID && process.env.APPLE_MUSIC_TEAM_ID && process.env.APPLE_MUSIC_PRIVATE_KEY_PATH);

      res.json({
        platforms: [
          {
            id: 'spotify',
            name: 'Spotify',
            available: spotifyAvailable,
            requiresAuth: true,
            searchAvailable: spotifyAvailable,
            playlistCreationAvailable: spotifyAvailable,
          },
          {
            id: 'apple-music',
            name: 'Apple Music',
            available: appleMusicAvailable,
            requiresAuth: true,
            searchAvailable: appleMusicAvailable,
            playlistCreationAvailable: appleMusicAvailable,
          },
        ],
      });
    } catch (error) {
      console.error('Get platforms error:', error);
      res.status(500).json({ error: 'Failed to get available platforms' });
    }
  }
);

// Get user music accounts
router.get('/accounts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const accounts = await prisma.userMusicAccount.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        platform: true,
        createdAt: true,
      },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Get music accounts error:', error);
    res.status(500).json({ error: 'Failed to get music accounts' });
  }
});

// Get music preferences
router.get('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const preferences = await prisma.userMusicPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    res.json({ preferences });
  } catch (error) {
    console.error('Get music preferences error:', error);
    res.status(500).json({ error: 'Failed to get music preferences' });
  }
});

// Update music preferences
router.put('/preferences', 
  authenticateToken,
  [
    body().isObject(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const newPreferences = req.body;

      const preferences = await prisma.userMusicPreferences.upsert({
        where: { userId },
        update: newPreferences,
        create: {
          userId,
          ...newPreferences,
        },
      });

      res.json({ preferences });
    } catch (error) {
      console.error('Update music preferences error:', error);
      res.status(500).json({ error: 'Failed to update music preferences' });
    }
  }
);

// Add account linking endpoints
router.post('/auth/:platform', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user!.id;
    
    console.log(`🔗 User ${userId} requesting to connect ${platform} account`);
    
    if (platform === 'spotify') {
      // Use exact same flow as login - regular state, not linking state
      const { oauthService } = await import('../services/oauthService');
      const { OAuthSessionService } = await import('../services/oauthSessionService');
      
      const state = oauthService.generateState();
      await OAuthSessionService.storeState(state, 'spotify');
      
      const authUrl = oauthService.getSpotifyAuthUrl(state);
      
      res.json({
        authUrl,
        state,
        tokenId: state
      });
    } else if (platform === 'apple-music') {
      // For Apple Music, we need the user to go through Apple Sign In again
      res.json({
        message: 'Apple Music linking requires Apple Sign In',
        authUrl: null, // This will be handled by the frontend differently
        requiresNativeAuth: true
      });
    } else {
      res.status(400).json({ error: 'Unsupported platform' });
    }
  } catch (error) {
    console.error('Platform auth error:', error);
    res.status(500).json({ error: 'Failed to initiate platform authentication' });
  }
});

// Delete/disconnect account
router.delete('/accounts/:accountId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.id;
    
    // Verify the account belongs to the user
    const account = await prisma.userMusicAccount.findFirst({
      where: {
        id: accountId,
        userId: userId
      }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Don't allow disconnecting the last/primary account
    const accountCount = await prisma.userMusicAccount.count({
      where: { userId }
    });
    
    if (accountCount <= 1) {
      return res.status(400).json({ 
        error: 'Cannot disconnect your only music account. Please connect another platform first.' 
      });
    }
    
    await prisma.userMusicAccount.delete({
      where: { id: accountId }
    });
    
    console.log(`🗑️ User ${userId} disconnected account ${accountId} (${account.platform})`);
    
    res.json({ success: true, message: 'Account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

export default router;