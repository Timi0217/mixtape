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
    query('platform').optional().isIn(['spotify', 'apple-music', 'youtube-music']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { q, platform, limit = 20 } = req.query;
      const platforms = platform ? [platform as string] : ['spotify', 'apple-music', 'youtube-music'];
      
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
        const updatedPlatformIds = { ...song.platformIds, ...platformIds };
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
    body('targetPlatform').isIn(['spotify', 'apple-music', 'youtube-music']),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { songs, targetPlatform } = req.body;

      const matchResults = await musicService.matchSongAcrossPlatforms(songs, targetPlatform);

      res.json({
        matches: matchResults,
        targetPlatform,
        totalSongs: songs.length,
      });
    } catch (error) {
      console.error('Song matching error:', error);
      res.status(500).json({ error: 'Song matching failed' });
    }
  }
);

router.get('/platforms',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      res.json({
        platforms: [
          {
            id: 'spotify',
            name: 'Spotify',
            available: false,
            requiresAuth: true,
          },
          {
            id: 'apple-music',
            name: 'Apple Music',
            available: false,
            requiresAuth: true,
          },
          {
            id: 'youtube-music',
            name: 'YouTube Music',
            available: false,
            requiresAuth: true,
          },
        ],
      });
    } catch (error) {
      console.error('Get platforms error:', error);
      res.status(500).json({ error: 'Failed to get available platforms' });
    }
  }
);

export default router;